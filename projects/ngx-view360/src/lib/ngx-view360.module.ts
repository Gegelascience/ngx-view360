import { NgModule } from '@angular/core';
import { NgxView360Component } from './ngx-view360.component';
import { VrButtonComponent } from './components/vr-button/vr-button.component';



@NgModule({
  declarations: [NgxView360Component, VrButtonComponent],
  imports: [
  ],
  exports: [NgxView360Component]
})
export class NgxView360Module { }
