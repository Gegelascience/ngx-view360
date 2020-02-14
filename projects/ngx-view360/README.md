# NgxView360

This library was generated with [Angular CLI](https://github.com/angular/angular-cli) version 8.2.14.

NgxView360 let you use 360 photo viewer in VR using Angular technology.
This library adapt one of the samples from [WebXR Sample](https://github.com/immersive-web/webxr-samples).
A great thanks to *The Immersive Web Community Group*.

## Breaking Change

From version 2.0.0 doesn't allow you to use a custom controller.
It use a lot resources for little result.
If you realy need custom controller, you can use the version 1.2.2.

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

The property 'customButtonStyle' has this structure:

```typescript
interface ButtonOptionStyle {
    color?: string;
    height?: number;
    corners?: any;
    backColor?: string;
    textEnterXRTitle?: string;
    textXRNotFoundTitle?: string;
    textExitXRTitle?: string;
}
```

Attributes | description
------------ | -------------
color(optional) | color of texts and logos and borders
height(optional) | height of the button (px).
corners(optional) | 'square' or 'round' or any number representing border-radius (px)
backColor(optional) | background color of vr button
textEnterXRTitle(optional) | Text showing when support for VR
textXRNotFoundTitle(optional) | Text showing when no support for VR
textExitXRTitle(optional) | Text showing when quiting vr experience (case with device associated with computer)


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

