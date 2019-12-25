import { TestBed } from '@angular/core/testing';

import { NgxView360Service } from './ngx-view360.service';

describe('NgxView360Service', () => {
  beforeEach(() => TestBed.configureTestingModule({}));

  it('should be created', () => {
    const service: NgxView360Service = TestBed.get(NgxView360Service);
    expect(service).toBeTruthy();
  });
});
