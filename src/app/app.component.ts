import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'ngxPhotos360webxr';

  imgSrc = 'assets/eiffel.jpg';

  customStyle = {
    color: 'white',
    backColor: 'crimson',
    height: 60
  };

  changeImgToSpace() {
    this.imgSrc = 'assets/space.jpg';
  }

  changeImgToEiffel() {
    this.imgSrc = 'assets/eiffel.jpg';
  }
}
