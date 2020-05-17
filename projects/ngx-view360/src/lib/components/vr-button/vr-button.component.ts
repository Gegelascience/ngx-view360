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
  };

  enabled = false;
  session = null;

  @Input() optionsStyle: ButtonOptionStyle;

  @Output() RequestSession = new EventEmitter();
  @Output() EndSession = new EventEmitter<any>();
  @Output() RequestFullScreen = new EventEmitter();

  @ViewChild('buttonMain', { static: true }) buttonEl: any;

  logoHeight: string;

  aspectDim: string;

  customButtonUIStyle = {};

  customLogoOKUIStyle = {};

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

    this.logoHeight = height * _LOGO_SCALE / 3 + 'px';
    this.aspectDim = height * _LOGO_SCALE * 14 / 27 + 'px';

    this.customButtonUIStyle['border-color'] = this.optionsStyle && this.optionsStyle.color ? this.optionsStyle.color : this.defaultOptionsStyle.color;
    this.customButtonUIStyle['border-radius.px'] = borderRadius;
    this.customButtonUIStyle['min-width.px'] = fontSize;

    this.customLogoOKUIStyle['width.px'] = height + fontSize;
    this.customLogoOKUIStyle['height.px'] = height - fontSize / 2;
    this.customLogoOKUIStyle['fill'] = this.optionsStyle && this.optionsStyle.color ? this.optionsStyle.color : this.defaultOptionsStyle.color;

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
    } else {
      this.RequestFullScreen.emit();
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
      this.setTitle('Exit XR presentation');
    } else if (this.enabled) {
      this.setTitle('Enter XR');
    } else {
      this.setTitle('No XR headset found.');
    }
    this.setDisabledAttribute(false);
  }

  setTitle(title) {
    this.renderer.setAttribute(this.buttonEl.nativeElement, 'title', title);
    return this;
  }

}
