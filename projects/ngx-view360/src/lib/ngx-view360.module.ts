import { NgModule } from '@angular/core';
import { NgxView360Component } from './components/ngx-view360/ngx-view360.component';
import { VrButtonComponent } from './components/vr-button/vr-button.component';
import { CommonModule } from '@angular/common';
import { NgxVideo360Component } from './components/ngx-video360/ngx-video360.component';



@NgModule({
  declarations: [NgxView360Component, VrButtonComponent, NgxVideo360Component],
  imports: [
    CommonModule
  ],
  exports: [NgxView360Component, NgxVideo360Component]
})
export class NgxView360Module { }
