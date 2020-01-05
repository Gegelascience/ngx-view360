import { Component, OnInit, EventEmitter, Output, ViewChild, ElementRef, Renderer2 } from '@angular/core';

@Component({
  selector: 'ngx-vr-button',
  templateUrl: './vr-button.component.html',
  styleUrls: ['./vr-button.component.css']
})
export class VrButtonComponent implements OnInit {

  optionsStyle = {
    color: 'rgb(80,168,252)',
    background: false,
    disabledOpacity: 0.5,
    height: 55,
    corners: 'square',
    textEnterXRTitle: 'ENTER VR',
    textXRNotFoundTitle: 'VR NOT FOUND',
    textExitXRTitle: 'EXIT VR',

  };

  titleButton = this.optionsStyle.textXRNotFoundTitle;

  enabled = false;
  session = null;
  forceDisabled = false;

  @Output() RequestSession = new EventEmitter();
  @Output() EndSession = new EventEmitter<any>();

  @ViewChild('buttonMain', { static: true }) buttonEl: ElementRef;

  logoHeight: number;

  aspectDim: number;

  customButtonUIStyle = {};

  customTitleUIStyle = {};

  customLogoOKUIStyle = {};

  customLogoNotOKUIStyle = {};

  constructor(private renderer: Renderer2) {

    const _LOGO_SCALE = 0.8;
    const borderRadius = this.getBorderRadius();
    const fontSize = this.optionsStyle.height / 3;

    this.logoHeight = this.optionsStyle.height * _LOGO_SCALE / 3;

    this.aspectDim = this.optionsStyle.height * _LOGO_SCALE * 14 / 27;

    this.customButtonUIStyle['border-color'] = this.optionsStyle.color;
    this.customButtonUIStyle['border-radius.px'] = borderRadius;
    this.customButtonUIStyle['height.px'] = this.optionsStyle.height;
    this.customButtonUIStyle['min-width.px'] = fontSize;

    this.customTitleUIStyle['color'] = this.optionsStyle.color;
    this.customTitleUIStyle['font-size.px'] = fontSize;
    this.customTitleUIStyle['padding-left.px'] = this.optionsStyle.height * 1.05;
    this.customTitleUIStyle['padding-right.px'] = (borderRadius - 10 < 5) ? fontSize : borderRadius - 10;

    this.customLogoOKUIStyle['width.px'] = this.optionsStyle.height - 4;
    this.customLogoOKUIStyle['height.px'] = this.optionsStyle.height - 4;
    this.customLogoOKUIStyle['fill'] = this.optionsStyle.color;
    this.customLogoOKUIStyle['margin-left.px'] = fontSize;
    this.customLogoOKUIStyle['margin-top.px'] = (this.optionsStyle.height - fontSize * _LOGO_SCALE) / 2 - 2;

    this.customLogoNotOKUIStyle['width.px'] = this.optionsStyle.height - 4;
    this.customLogoNotOKUIStyle['height.px'] = this.optionsStyle.height - 4;
    this.customLogoNotOKUIStyle['fill'] = this.optionsStyle.color;
    this.customLogoNotOKUIStyle['margin-left.px'] = fontSize;
    this.customLogoNotOKUIStyle['margin-top.px'] = (this.optionsStyle.height - 28 / 18 * fontSize * _LOGO_SCALE) / 2 - 2;
  }

  ngOnInit() {
  }

  getBorderRadius() {
    let borderRadius;
    if (this.optionsStyle.corners === 'round') {
      borderRadius = this.optionsStyle.height / 2;
    } else if (this.optionsStyle.corners === 'square') {
      borderRadius = 2;
    } else {
      borderRadius = this.optionsStyle.corners;
    }
    return borderRadius;
  }

  onXRButtonClick() {
    if (this.session) {
      this.EndSession.emit(this.session);

    } else if (this.enabled) {
      this.RequestSession.emit();
    }
  }

  setDisabledAttribute(disabled) {
    if (disabled || this.forceDisabled) {
      this.renderer.setStyle(this.buttonEl.nativeElement, 'opacity', 0.5);
    } else {
      this.renderer.setStyle(this.buttonEl.nativeElement, 'opacity', 1);
    }
  }

  setSession(session) {
    this.session = session;
    this.updateButtonState();
    return this;
  }

  updateButtonState() {
    if (this.session) {
      this.setTitle(this.optionsStyle.textExitXRTitle, 'Exit XR presentation');
      this.setDisabledAttribute(false);
    } else if (this.enabled) {
      this.setTitle(this.optionsStyle.textEnterXRTitle, 'Enter XR');
      this.setDisabledAttribute(false);
    } else {
      this.setTitle(this.optionsStyle.textXRNotFoundTitle, 'No XR headset found.');
      this.setDisabledAttribute(true);
    }
  }

  setTitle(text, title) {
    this.titleButton = text;
    this.renderer.setAttribute(this.buttonEl.nativeElement, 'title', title);
    return this;
  }

}
