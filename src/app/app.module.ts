import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { NgxView360Module } from '../../projects/ngx-view360/src/lib/ngx-view360.module';

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
