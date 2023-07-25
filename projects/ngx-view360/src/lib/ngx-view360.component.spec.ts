import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxView360Component } from './ngx-view360.component';
import { VrButtonComponent } from './components/vr-button/vr-button.component';

describe('NgxView360Component', () => {
  let component: NgxView360Component;
  let fixture: ComponentFixture<NgxView360Component>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgxView360Component,VrButtonComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(NgxView360Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
