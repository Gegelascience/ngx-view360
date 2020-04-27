import { Component } from '@angular/core';

@Component({
  selector: 'app-root',
  templateUrl: './app.component.html',
  styleUrls: ['./app.component.css']
})
export class AppComponent {
  title = 'ngxPhotos360webxr';

  //imgSrc = 'assets/eiffel.jpg';
  imgSrc = 'https://upload.wikimedia.org/wikipedia/commons/thumb/6/67/Castle_Church_of_Lutherstadt_Wittenberg_%28interior%2C_full_spherical_panoramic_image%2C_equirectangular_projection%29.jpg/1280px-Castle_Church_of_Lutherstadt_Wittenberg_%28interior%2C_full_spherical_panoramic_image%2C_equirectangular_projection%29.jpg'

  customButtonStyle = {
    color: 'white',
    backColor: 'crimson',
    height: 60
  };

  customCanvas = {
    height: '50vh',
    width: '50vw'
  };

  changeImgToSpace() {
    this.imgSrc = 'assets/space.jpg';
  }

  changeImgToEiffel() {
    this.imgSrc = 'assets/eiffel.jpg';
  }
}
