import { NgModule } from '@angular/core';
import { CommonModule } from '@angular/common';
import { View360Component } from './components/view360/view360.component';


@NgModule({
  declarations: [View360Component],
  imports: [
    CommonModule,
  ],
  exports: [
    View360Component,
  ]
})
export class NgxPhoto360Module { }
