import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';

import { AppComponent } from './app.component';
import { NgxPhoto360Module } from './module/ngx-photo360/ngx-photo360.module';

@NgModule({
  declarations: [
    AppComponent,
  ],
  imports: [
    BrowserModule,
    NgxPhoto360Module
  ],
  providers: [],
  bootstrap: [AppComponent]
})
export class AppModule { }
