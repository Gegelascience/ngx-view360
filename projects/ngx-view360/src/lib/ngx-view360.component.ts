import { Component, OnInit, Input, HostListener, AfterViewInit, ViewChild, OnChanges, SimpleChanges } from '@angular/core';
import { Scene, WebXRView } from './class/render/scenes/scene';
import { Renderer, createWebGLContext } from './class/render/core/renderer';
import { Gltf2Node } from './class/render/nodes/gltf2';
import { SkyboxNode } from './class/render/nodes/skybox';
import { InlineViewerHelper } from './class/util/inline-viewer-helper';
import { VrButtonComponent } from './components/vr-button/vr-button.component';
import { ButtonOptionStyle } from './models/button-option-style';
import { CanvasOptionStyle } from './models/canvas-option-style';

declare var navigator: any;
declare var XRWebGLLayer: any;

@Component({
  selector: 'ngx-view360',
  templateUrl: './ngx-view360.component.html',
  styleUrls: ['./ngx-view360.component.css']
})
export class NgxView360Component implements OnInit, AfterViewInit, OnChanges {

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
   * custom button style
   */
  @Input() customButtonStyle: ButtonOptionStyle;


  /**
   * custom canvas style
   */
  @Input() customCanvasStyle: CanvasOptionStyle;

  @ViewChild('webxrContainer', { static: true }) webxrContainer;

  @ViewChild(VrButtonComponent, { static: true }) vrButton: VrButtonComponent;

  xrImmersiveRefSpace = null;
  inlineViewerHelper: InlineViewerHelper = null;
  gl = null;
  scene: Scene = new Scene();

  customButtonBackground = {};

  customCanvasBackground = {};

  primaryTouch;
  prevTouchX;
  prevTouchY;


  constructor() { }

  ngOnChanges(changes: SimpleChanges) {
    if (this.customButtonStyle && this.customButtonStyle.backColor) {
      this.customButtonBackground['background-color'] = this.customButtonStyle.backColor;
    }
    if (this.imageSrc !== null && this.imageSrc !== undefined) {
      this.scene.addNode(new SkyboxNode({
        url: this.imageSrc,
        displayMode: this.displayMode
      }));
    } else {
      console.error('path to image invalid');
    }
    if (this.customCanvasStyle && this.customCanvasStyle.width) {
      this.customCanvasBackground['width'] = this.customCanvasStyle.width;
    }
    if (this.customCanvasStyle && this.customCanvasStyle.height) {
      this.customCanvasBackground['height'] = this.customCanvasStyle.height;
    }
  }

  ngOnInit() { }

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
    }, this.webxrContainer.nativeElement);
    this.onResize();
    this.scene.setRenderer(new Renderer(this.gl));
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
        this.inlineViewerHelper = new InlineViewerHelper(refSpace);
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


  mouseMove(event) {
    // Only rotate when the left button is pressed
    if (event.buttons & 1) {
      this.inlineViewerHelper.rotateView(event.movementX, event.movementY);
    }
  }

  touchStart(event) {
    if (this.primaryTouch === undefined) {
      const touch = event.changedTouches[0];
      this.primaryTouch = touch.identifier;
      this.prevTouchX = touch.pageX;
      this.prevTouchY = touch.pageY;
    }
  }

  touchEnd(event) {
    for (const touch of event.changedTouches) {
      if (this.primaryTouch === touch.identifier) {
        this.primaryTouch = undefined;
        this.inlineViewerHelper.rotateView(touch.pageX - this.prevTouchX, touch.pageY - this.prevTouchY);
      }
    }
  }

  touchCancel(event) {
    for (const touch of event.changedTouches) {
      if (this.primaryTouch === touch.identifier) {
        this.primaryTouch = undefined;
      }
    }
  }

  touchMove(event) {
    for (const touch of event.changedTouches) {
      if (this.primaryTouch === touch.identifier) {
        this.inlineViewerHelper.rotateView(touch.pageX - this.prevTouchX, touch.pageY - this.prevTouchY);
        this.prevTouchX = touch.pageX;
        this.prevTouchY = touch.pageY;
      }
    }
  }


}
