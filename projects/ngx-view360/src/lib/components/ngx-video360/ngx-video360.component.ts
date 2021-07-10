import { Component, OnInit, Input, ViewChild, HostListener, OnChanges, SimpleChanges } from '@angular/core';
import { Scene, WebXRView } from '../../class/render/scenes/scene';
import { Renderer, createWebGLContext } from '../../class/render/core/renderer';
import { InlineViewerHelper } from '../../class/util/inline-viewer-helper';
import { VrButtonComponent } from '../vr-button/vr-button.component';
import { ButtonOptionStyle } from '../../models/button-option-style';
import { CanvasOptionStyle } from '../../models/canvas-option-style';
import { VideoNode } from '../../class/render/nodes/videobox';

declare var navigator: any;
declare var XRWebGLLayer: any;

@Component({
  selector: 'ngx-video360',
  templateUrl: './ngx-video360.component.html',
  styleUrls: ['./ngx-video360.component.css']
})
export class NgxVideo360Component implements OnInit, OnChanges {

  /**
   * path to video
   */
  @Input() videoSrc: string;
  /**
   * mode of image: 'mono' || 'stereoTopBottom' || 'stereoLeftRight'
   */
  @Input() displayMode?: string;

  /**
   * custom button style
   */
  @Input() customButtonStyle: ButtonOptionStyle;


  /**
   * custom canvas style
   */
  @Input() customCanvasStyle: CanvasOptionStyle;


  /**
   * enable vr button
   */
  @Input() showVRButton = true;

  @ViewChild('webxrContainer', { static: true }) webxrContainer;

  @ViewChild(VrButtonComponent, { static: true }) vrButton: VrButtonComponent;

  xrImmersiveRefSpace = null;
  inlineViewerHelper: InlineViewerHelper = null;
  gl = null;
  scene: Scene = new Scene();

  customButtonBackground = {};


  video: HTMLVideoElement = null;

  customCanvasBackground: CanvasOptionStyle = {
    width: '50vw',
    height: '50vh'
  };

  primaryTouch;
  prevTouchX: number;
  prevTouchY: number;



  constructor() { }

  ngOnInit(): void {
    this.initXR();
  }

  ngOnChanges(changes: SimpleChanges) {
    const video = document.createElement('video');
    video.loop = true;
    video.src = 'assets/100_0029.MP4';

    const videoNode = new VideoNode({
      video: video,
      displayMode: 'stereoTopBottom'
    });

    // When the video is clicked we'll pause it if it's playing.
    videoNode.onSelect(() => {
      if (!video.paused) {
        // playButton.visible = true;
        video.pause();
      } else {
        // playButton.visible = false;
        video.play();
      }
    });
    videoNode.selectable = true;

    // Move back to the position of the in-room screen and size to cover it.
    // Values determined experimentally and with many refreshes.
    videoNode.translation = [0.025, 0.275, -4.4];
    videoNode.scale = [2.1, 1.1, 1.0];
    this.scene.addNode(videoNode);

    video.addEventListener('loadeddata', () => {
      // Once the video has loaded up adjust the aspect ratio of the "screen"
      // to fit the video's native shape.
      const aspect = videoNode.aspectRatio;
      if (aspect < 2.0) {
        videoNode.scale = [aspect * 1.1, 1.1, 1.0];
      } else {
        videoNode.scale = [2.1, 2.1 / aspect, 1.0];
      }
    });


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
  }

  @HostListener('window:resize', [])
  onResize() {
    this.gl.canvas.width = this.gl.canvas.clientWidth * window.devicePixelRatio;
    this.gl.canvas.height = this.gl.canvas.clientHeight * window.devicePixelRatio;
  }

  onRequestSession() {
    // let autoplay = autoplayCheckbox.checked;
    const autoplay = true;

    let pending;

    if (autoplay) {
      // If we want the video to autoplay when the session has fully started
      // (which may be several seconds after the original requestSession
      // call due to clicking through consent prompts or similar) then we
      // need to start the video within a user activation event first
      // (which this function is.) Once it's been started successfully we
      // pause it, at which point we can resume it pretty much whenever we'd
      // like.
      pending = this.video.play().then(() => {
        this.video.pause();
      });
    }

    return navigator.xr.requestSession('immersive-vr', {
      requiredFeatures: ['local-floor']
    }).then((session) => {
      this.vrButton.setSession(session);
      session.isImmersive = true;
      this.onSessionStarted(session);

      if (autoplay) {
        pending.then(() => {
          this.video.play();
        });
      }
    });
  }

  onSessionStarted(session) {
    session.addEventListener('end', this.onSessionEnded);
    session.addEventListener('select', (ev) => {
      let refSpace = ev.frame.session.isImmersive ?
        this.xrImmersiveRefSpace :
        this.inlineViewerHelper.referenceSpace;
      this.scene.handleSelect();
    });

    this.initGL();
    // this.scene.inputRenderer.useProfileControllerMeshes(session);

    let glLayer = new XRWebGLLayer(session, this.gl);
    session.updateRenderState({ baseLayer: glLayer });

    // In this case we're going to use an 'local' frame of reference
    // because we want to users head to appear in the right place relative
    // to the center chair, as if they're sitting in it, rather than
    // somewhere in the room relative to the floor.
    let refSpaceType = session.isImmersive ? 'local' : 'viewer';
    session.requestReferenceSpace(refSpaceType).then((refSpace) => {
      if (session.isImmersive) {
        this.xrImmersiveRefSpace = refSpace;
      } else {
        this.inlineViewerHelper = new InlineViewerHelper(refSpace);
      }

      session.requestAnimationFrame(this.onXRFrame);
    });
  }

  onSessionEnded(event) {
    if (event.session.isImmersive) {
      this.vrButton.setSession(null);
      this.video.pause();
    }
  }

  onEndSession(session) {
    session.end();
  }

  onFullScreenStart = () => {
    if (this.webxrContainer.nativeElement.requestFullscreen) {
      this.webxrContainer.nativeElement.requestFullscreen();
    }
  }

  onFullScreenEnd = () => {
    if (this.webxrContainer.nativeElement.exitFullscreen) {
      this.webxrContainer.nativeElement.exitFullscreen();
    }
  }

  onXRFrame(t, frame) {
    let session = frame.session;
    let refSpace = session.isImmersive ?
      this.xrImmersiveRefSpace :
      this.inlineViewerHelper.referenceSpace;
    let pose = frame.getViewerPose(refSpace);

    this.scene.startFrame();

    session.requestAnimationFrame(this.onXRFrame);

    this.scene.updateInputSources(frame, refSpace);

    this.scene.drawXRFrame(frame, pose);

    this.scene.endFrame();
  }

  mouseMove(event) {
    // Only rotate when the left button is pressed
    // tslint:disable-next-line:no-bitwise
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
