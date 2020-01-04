import { Component, OnInit, EventEmitter, Output, ViewChild, ElementRef, Renderer2 } from '@angular/core';

@Component({
  selector: 'ngx-vr-button',
  templateUrl: './vr-button.component.html',
  styleUrls: ['./vr-button.component.css']
})
export class VrButtonComponent implements OnInit {

  _LOGO_SCALE = 0.8;
  _WEBXR_UI_CSS_INJECTED = {};

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

  logoHeight = this.optionsStyle.height * this._LOGO_SCALE / 3;

  aspectDim = this.optionsStyle.height * this._LOGO_SCALE * 14 / 27;

  tierceHeight = this.optionsStyle.height / 3;

  constructor(private renderer: Renderer2) {

  }

  ngOnInit() {
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
