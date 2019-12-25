import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { NgxView360Module } from 'ngx-view360';


@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    NgxView360Module
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
