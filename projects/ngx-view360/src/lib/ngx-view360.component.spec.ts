import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxView360Component } from './ngx-view360.component';

describe('NgxView360Component', () => {
  let component: NgxView360Component;
  let fixture: ComponentFixture<NgxView360Component>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ NgxView360Component ]
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
