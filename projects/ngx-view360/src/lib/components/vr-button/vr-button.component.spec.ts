import { async, ComponentFixture, TestBed } from '@angular/core/testing';

import { VrButtonComponent } from './vr-button.component';

describe('VrButtonComponent', () => {
  let component: VrButtonComponent;
  let fixture: ComponentFixture<VrButtonComponent>;

  beforeEach(async(() => {
    TestBed.configureTestingModule({
      declarations: [ VrButtonComponent ]
    })
    .compileComponents();
  }));

  beforeEach(() => {
    fixture = TestBed.createComponent(VrButtonComponent);
    component = fixture.componentInstance;
    fixture.detectChanges();
  });

  it('should create', () => {
    expect(component).toBeTruthy();
  });
});
