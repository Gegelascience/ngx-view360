import { Component, EventEmitter, Output, ViewChild, Renderer2, Input, OnChanges, SimpleChanges } from '@angular/core';
import { ButtonOptionStyle } from '../../models/button-option-style';

@Component({
  selector: 'ngx-vr-button',
  templateUrl: './vr-button.component.html',
  styleUrls: ['./vr-button.component.css']
})
export class VrButtonComponent implements OnChanges {


  defaultOptionsStyle: ButtonOptionStyle = {
    color: 'rgb(80,168,252)',
    height: 55,
    corners: 'square',
    textEnterXRTitle: 'ENTER VR',
    textXRNotFoundTitle: 'VR NOT FOUND',
    textExitXRTitle: 'EXIT VR',

  };

  titleButton: string;

  enabled = false;
  session = null;

  @Input() optionsStyle: ButtonOptionStyle;

  @Output() RequestSession = new EventEmitter();
  @Output() EndSession = new EventEmitter<any>();

  @ViewChild('buttonMain', { static: true }) buttonEl: any;

  logoHeight: number;

  aspectDim: number;

  customButtonUIStyle = {};

  customTitleUIStyle = {};

  customLogoOKUIStyle = {};

  customLogoNotOKUIStyle = {};

  constructor(private renderer: Renderer2) { }

  ngOnChanges(changes: SimpleChanges) {
    this.setCustomStyle();
  }

  setCustomStyle() {
    const _LOGO_SCALE = 0.8;
    const height = this.optionsStyle && this.optionsStyle.height ? this.optionsStyle.height : this.defaultOptionsStyle.height;
    const corners = this.optionsStyle && this.optionsStyle.corners ? this.optionsStyle.corners : this.defaultOptionsStyle.corners;
    const borderRadius = this.getBorderRadius(height, corners);
    const fontSize = height / 3;

    this.titleButton = this.optionsStyle && this.optionsStyle.textXRNotFoundTitle ? this.optionsStyle.textXRNotFoundTitle : this.defaultOptionsStyle.textXRNotFoundTitle;

    this.logoHeight = height * _LOGO_SCALE / 3;
    this.aspectDim = height * _LOGO_SCALE * 14 / 27;

    this.customButtonUIStyle['border-color'] = this.optionsStyle && this.optionsStyle.color ? this.optionsStyle.color : this.defaultOptionsStyle.color;
    this.customButtonUIStyle['border-radius.px'] = borderRadius;
    this.customButtonUIStyle['height.px'] = height;
    this.customButtonUIStyle['min-width.px'] = fontSize;

    this.customTitleUIStyle['color'] = this.optionsStyle && this.optionsStyle.color ? this.optionsStyle.color : this.defaultOptionsStyle.color;
    this.customTitleUIStyle['font-size.px'] = fontSize;
    this.customTitleUIStyle['padding-left.px'] = height * 1.05;
    this.customTitleUIStyle['padding-right.px'] = (borderRadius - 10 < 5) ? fontSize : borderRadius - 10;

    this.customLogoOKUIStyle['width.px'] = height - 4;
    this.customLogoOKUIStyle['height.px'] = height - 4;
    this.customLogoOKUIStyle['fill'] = this.optionsStyle && this.optionsStyle.color ? this.optionsStyle.color : this.defaultOptionsStyle.color;
    this.customLogoOKUIStyle['margin-left.px'] = fontSize;
    this.customLogoOKUIStyle['margin-top.px'] = (height - fontSize * _LOGO_SCALE) / 2 - 2;

    this.customLogoNotOKUIStyle['width.px'] = height - 4;
    this.customLogoNotOKUIStyle['height.px'] = height - 4;
    this.customLogoNotOKUIStyle['fill'] = this.optionsStyle && this.optionsStyle.color ? this.optionsStyle.color : this.defaultOptionsStyle.color;
    this.customLogoNotOKUIStyle['margin-left.px'] = fontSize;
    this.customLogoNotOKUIStyle['margin-top.px'] = (height - 28 / 18 * fontSize * _LOGO_SCALE) / 2 - 2;
  }

  getBorderRadius(height, corners) {
    let borderRadius;
    if (corners === 'round') {
      borderRadius = height / 2;
    } else if (corners === 'square') {
      borderRadius = 2;
    } else {
      borderRadius = corners;
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
    if (disabled) {
      this.renderer.setAttribute(this.buttonEl.nativeElement, 'disabled', 'true');
      this.renderer.setStyle(this.buttonEl.nativeElement, 'opacity', 0.5);
    } else {
      this.renderer.removeAttribute(this.buttonEl.nativeElement, 'disabled');
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
      const title = this.optionsStyle && this.optionsStyle.textExitXRTitle ? this.optionsStyle.textExitXRTitle : this.defaultOptionsStyle.textExitXRTitle;
      this.setTitle(title, 'Exit XR presentation');
      this.setDisabledAttribute(false);
    } else if (this.enabled) {
      const title = this.optionsStyle && this.optionsStyle.textEnterXRTitle ? this.optionsStyle.textEnterXRTitle : this.defaultOptionsStyle.textEnterXRTitle;
      this.setTitle(title, 'Enter XR');
      this.setDisabledAttribute(false);
    } else {
      const title = this.optionsStyle && this.optionsStyle.textXRNotFoundTitle ? this.optionsStyle.textXRNotFoundTitle : this.defaultOptionsStyle.textXRNotFoundTitle;
      this.setTitle(title, 'No XR headset found.');
      this.setDisabledAttribute(true);
    }
  }

  setTitle(text, title) {
    this.titleButton = text;
    this.renderer.setAttribute(this.buttonEl.nativeElement, 'title', title);
    return this;
  }

}
