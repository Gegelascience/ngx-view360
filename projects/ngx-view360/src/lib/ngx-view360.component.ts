import { Component, OnInit, Input, HostListener, AfterViewInit, ViewChild, Renderer2 } from '@angular/core';
import { Scene, WebXRView } from './class/render/scenes/scene';
import { WebXRButton } from './class/util/webxr-button';
import { Renderer, createWebGLContext } from './class/render/core/renderer';
import { Gltf2Node } from './class/render/nodes/gltf2';
import { SkyboxNode } from './class/render/nodes/skybox';
import { InlineViewerHelper } from './class/util/inline-viewer-helper';

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

  @ViewChild('buttonVr', { static: true }) buttonVr;
  @ViewChild('webxrContainer', { static: true }) webxrContainer;
  xrButton = null;
  xrImmersiveRefSpace = null;
  inlineViewerHelper = null;
  gl = null;
  renderer = null;
  scene = new Scene();


  constructor(private rendererAngular: Renderer2) { }

  ngOnInit() {

    this.scene.addNode(new SkyboxNode({
      url: this.imageSrc,
      displayMode: this.displayMode
    }));
  }

  ngAfterViewInit() {
    // Start the XR application.
    this.initXR();
  }

  initXR() {
    this.xrButton = new WebXRButton({
      onRequestSession: this.onRequestSession,
      onEndSession: this.onEndSession
    });
    this.rendererAngular.appendChild(this.buttonVr.nativeElement, this.xrButton.domElement);
    if (navigator.xr) {
      navigator.xr.isSessionSupported('immersive-vr').then((supported) => {
        this.xrButton.enabled = supported;
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
    this.rendererAngular.setStyle(this.webxrContainer.nativeElement.firstChild, 'width', '80%');
    this.rendererAngular.setStyle(this.webxrContainer.nativeElement.firstChild, 'height', 'inherit');
    this.rendererAngular.setStyle(this.webxrContainer.nativeElement.firstChild, 'touch-action', 'none');

    this.onResize();
    this.renderer = new Renderer(this.gl);
    this.scene.setRenderer(this.renderer);
    this.scene.inputRenderer.setControllerMesh(new Gltf2Node({ url: this.rightController }), 'right');
    this.scene.inputRenderer.setControllerMesh(new Gltf2Node({ url: this.leftController }), 'left');
  }


  @HostListener('window:resize', [])
  onResize() {
    this.gl.canvas.width = this.gl.canvas.clientWidth * window.devicePixelRatio;
    this.gl.canvas.height = this.gl.canvas.clientHeight * window.devicePixelRatio;
  }

  onRequestSession = () => {
    return navigator.xr.requestSession('immersive-vr').then((session) => {
      this.xrButton.setSession(session);
      session.isImmersive = true;
      this.onSessionStarted(session);
    });
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
      this.xrButton.setSession(null);
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
