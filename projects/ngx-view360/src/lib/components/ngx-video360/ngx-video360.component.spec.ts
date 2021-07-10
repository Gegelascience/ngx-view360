import { ComponentFixture, TestBed } from '@angular/core/testing';

import { NgxVideo360Component } from './ngx-video360.component';

describe('NgxVideo360Component', () => {
  let component: NgxVideo360Component;
  let fixture: ComponentFixture<NgxVideo360Component>;

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      declarations: [ NgxVideo360Component ]
    })
    .compileComponents();
  });

  beforeEach(() => {
    fixture = TestBed.createComponent(NgxVideo360Component);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
