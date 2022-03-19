# NgxView360

NgxView360 let you use 360 photo viewer in VR using Angular technology.
This library adapt one of the samples from [WebXR Sample](https://github.com/immersive-web/webxr-samples).
A great thanks to *The Immersive Web Community Group*.

If VR is not supported, a magic window is enabled.

This library was generated with [Angular CLI](https://github.com/angular/angular-cli).


## Warnings

**You must use _https_ to display XR content. If you use _http_ you will only have cardboard display.**
[More informations](https://www.w3.org/TR/webxr/)

## Versions

NgxView360 | Angular
------------ | -------------
2.0.0 | 8
2.1.0 + | 9-12 
2.2.1  | 13 +

## Changelog

[see file](https://github.com/Gegelascience/ngx-view360/blob/master/projects/ngx-view360/changelog.md)

## Setup

### Installing

First, you will need to add the webxr polyfill. Some browsers don't have develop in production the WEBXR API.
You will need also to install gl-matrix package to calculate webgl matrix.

````
npm i webxr-polyfill --save
npm i gl-matrix --save
````

Then append these lines on polyfills.ts:

```typescript
import WebXRPolyfill from 'webxr-polyfill';
let polyfill = new WebXRPolyfill();
```

Now, you can add the library:

````
npm i ngx-view360 --save
````

### Using

Import NgxView360Module on AppModule.

```typescript
import { NgxView360Module } from 'ngx-view360';

@NgModule({...
  imports: [...,
    NgxView360Module
  ...],
})
```

Then, you can use the component in template:

```html
<ngx-view360 imageSrc="path/to/image"></ngx-view360>
```

## API

The **NgxView360Component** has some attributes to display the view.

Attributes | description
------------ | -------------
imageSrc | source of the image to display, need to be a equirectangular image (jpg or png accepted)
displayMode(optional) | Mode to display image ('mono', 'stereoTopBottom','stereoLeftRight'). 'mono' is the default mode.
customButtonStyle(optional) | object to customize vr button
customCanvasStyle(optional) | object to customize canvas dimensions
showVRButton(optional) | boolean to show VR button (default value: true)

The property 'customButtonStyle' has this structure:

```typescript
interface ButtonOptionStyle {
    color?: string;
    height?: number;
    corners?: any;
    backColor?: string;
}
```

Attributes | description
------------ | -------------
color(optional) | color of texts and logos and borders
height(optional) | height of the button (px).
corners(optional) | 'square' or 'round' or any number representing border-radius (px)
backColor(optional) | background color of vr button


The property 'customCanvasStyle' has this structure:

```typescript
interface CanvasOptionStyle {
    height?: string;
    width?: string;
}
```

Attributes | description
------------ | -------------
height(optional) | height of the canvas.
width(optional) | width of the canvas




## LICENSE

MIT

