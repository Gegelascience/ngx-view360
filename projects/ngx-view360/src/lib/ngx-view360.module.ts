import { NgModule } from '@angular/core';
import { NgxView360Component } from './ngx-view360.component';
import { VrButtonComponent } from './components/vr-button/vr-button.component';
import { CommonModule } from '@angular/common';



@NgModule({
  declarations: [NgxView360Component, VrButtonComponent],
  imports: [
    CommonModule
  ],
  exports: [NgxView360Component]
})
export class NgxView360Module { }
