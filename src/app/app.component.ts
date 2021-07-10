import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'ngxPhotos360webxr';

  imgSrc = 'assets/eiffel.jpg';
  // imgSrc = 'assets/100_0017.JPG'

  customButtonStyle = {
    color: 'crimson',
    backColor: 'white',
    height: 60
  };

  customCanvas = {
    height: '60vh',
    width: '60vw'
  };

  changeImgToSpace() {
    this.imgSrc = 'assets/space.jpg';
  }

  changeImgToEiffel() {
    this.imgSrc = 'assets/eiffel.jpg';
  }
}
