import { Component, OnInit, Input, HostListener, AfterViewInit, ViewChild, Renderer2 } from '@angular/core';
import { Scene, WebXRView } from './class/render/scenes/scene';
import { Renderer, createWebGLContext } from './class/render/core/renderer';
import { Gltf2Node } from './class/render/nodes/gltf2';
import { SkyboxNode } from './class/render/nodes/skybox';
import { InlineViewerHelper } from './class/util/inline-viewer-helper';
import { VrButtonComponent } from './components/vr-button/vr-button.component';
import { OptionStyle } from './models/option-style';

declare var navigator: any;
declare var XRWebGLLayer: any;

@Component({
  selector: 'ngx-view360',
  templateUrl: './ngx-view360.component.html',
  styleUrls: ['./ngx-view360.component.css']
})
export class NgxView360Component implements OnInit, AfterViewInit {

  /**
   * path to image
   */
  @Input() imageSrc: string;
  /**
   * mode of image: 'mono' || 'stereoTopBottom' || 'stereoLeftRight'
   */
  @Input() displayMode?: string;
  /**
   * gltf2 file containing right controller 3D model
   */
  @Input() rightController: string;
  /***
   * gltf2 file containing left controller 3D model
   */
  @Input() leftController: string;

  /**
   * custom style
   */
  @Input() customStyle: OptionStyle;

  @ViewChild('webxrContainer', { static: true }) webxrContainer;

  @ViewChild(VrButtonComponent, { static: true }) vrButton: VrButtonComponent;

  xrImmersiveRefSpace = null;
  inlineViewerHelper: InlineViewerHelper = null;
  gl = null;
  renderer: Renderer = null;
  scene: Scene = new Scene();

  customBackground = {};


  constructor(private rendererAngular: Renderer2) { }

  ngOnInit() {
    if (this.customStyle && this.customStyle.backColor) {
      this.customBackground['background-color'] = this.customStyle.backColor;
    }
    if (this.imageSrc !== null && this.imageSrc !== undefined) {
      this.scene.addNode(new SkyboxNode({
        url: this.imageSrc,
        displayMode: this.displayMode
      }));
    } else {
      console.error('path to image invalid');
    }
  }

  ngAfterViewInit() {
    // Start the XR application.
    if (this.imageSrc !== null && this.imageSrc !== undefined) {
      this.initXR();
    }
  }

  initXR() {
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        this.vrButton.enabled = supported;
        this.vrButton.updateButtonState();
      });
      navigator.xr.requestSession('inline').then(this.onSessionStarted);
    }
  }

  initGL() {
    if (this.gl) {
      return;
    }

    this.gl = createWebGLContext({
      xrCompatible: true
    });
    this.rendererAngular.appendChild(this.webxrContainer.nativeElement, this.gl.canvas);
    this.rendererAngular.setStyle(this.webxrContainer.nativeElement.firstChild, 'position', 'relative');
    this.rendererAngular.setStyle(this.webxrContainer.nativeElement.firstChild, 'z-index', '0');
    this.rendererAngular.setStyle(this.webxrContainer.nativeElement.firstChild, 'width', '100%');
    this.rendererAngular.setStyle(this.webxrContainer.nativeElement.firstChild, 'height', 'inherit');
    this.rendererAngular.setStyle(this.webxrContainer.nativeElement.firstChild, 'touch-action', 'none');

    this.onResize();
    this.renderer = new Renderer(this.gl);
    this.scene.setRenderer(this.renderer);
    if (this.leftController !== null && this.leftController !== undefined) {
      if (this.rightController !== null && this.rightController !== undefined) {
        this.scene.inputRenderer.setControllerMesh(new Gltf2Node({ url: this.rightController }), 'right');
        this.scene.inputRenderer.setControllerMesh(new Gltf2Node({ url: this.leftController }), 'left');
        this.scene.ControllersMeshExist = true;
      }
    }
  }


  @HostListener('window:resize', [])
  onResize() {
    this.gl.canvas.width = this.gl.canvas.clientWidth * window.devicePixelRatio;
    this.gl.canvas.height = this.gl.canvas.clientHeight * window.devicePixelRatio;
  }

  onRequestSession = () => {
    return navigator.xr.requestSession('immersive-vr').then((session) => {
      this.vrButton.setSession(session);
      session.isImmersive = true;
      this.onSessionStarted(session);
    }).catch((err => {
      const errorMsg = `XRSession creation failed: ${err.message}`;
      console.error(errorMsg);
      this.vrButton.setDisabledAttribute(true);
      setTimeout(() => {
        this.vrButton.setDisabledAttribute(false);
      }, 1000);
    }));
  }

  onSessionStarted = (session) => {
    session.addEventListener('end', this.onSessionEnded);
    this.initGL();
    const glLayer = new XRWebGLLayer(session, this.gl);
    session.updateRenderState({ baseLayer: glLayer });
    const refSpaceType = session.isImmersive ? 'local' : 'viewer';
    session.requestReferenceSpace(refSpaceType).then((refSpace) => {
      if (session.isImmersive) {
        this.xrImmersiveRefSpace = refSpace;
      } else {
        this.inlineViewerHelper = new InlineViewerHelper(this.gl.canvas, refSpace);
      }
      session.requestAnimationFrame(this.onXRFrame);
    });
  }

  onEndSession = (session) => {
    session.end();
  }
  onSessionEnded = (event) => {
    if (event.session.isImmersive) {
      this.vrButton.setSession(null);
    }
  }
  onXRFrame = (t, frame) => {
    const session = frame.session;
    const refSpace = session.isImmersive ?
      this.xrImmersiveRefSpace :
      this.inlineViewerHelper.referenceSpace;
    const pose = frame.getViewerPose(refSpace);
    this.scene.startFrame();
    session.requestAnimationFrame(this.onXRFrame);
    const glLayer = session.renderState.baseLayer;
    this.gl.bindFramebuffer(this.gl.FRAMEBUFFER, glLayer.framebuffer);
    this.gl.clear(this.gl.COLOR_BUFFER_BIT | this.gl.DEPTH_BUFFER_BIT);
    if (pose) {
      const views = [];
      for (const view of pose.views) {
        const renderView = new WebXRView(view, glLayer);
        // It's important to take into account which eye the view is
        // associated with in cases like this, since it informs which half
        // of the stereo image should be used when rendering the view.
        renderView.eye = view.eye;
        views.push(renderView);
      }
      this.scene.updateInputSources(frame, refSpace);
      this.scene.drawViewArray(views);
    }
    this.scene.endFrame();
  }


}
