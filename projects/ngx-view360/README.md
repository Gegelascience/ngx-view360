# NgxView360

This library was generated with [Angular CLI](https://github.com/angular/angular-cli) version 8.2.14.

NgxView360 let you use 360 photo viewer in VR using Angular technology.
This library adapt one of the samples from [WebXR Sample](https://github.com/immersive-web/webxr-samples).
A great thanks to *The Immersive Web Community Group*.

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
import WebXRPolyfill from 'webxr-polyfill/build/webxr-polyfill.module.js';
let polyfill = new WebXRPolyfill();
```

Now, you can add the library:

````
npm i ngx-view360 --save
````

## Using

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

## Library

The **NgxView360Component** has some attributes to display the view

Attributes | description
------------ | -------------
imageSrc | source of the image to display, need to be a equirectangular image (jpg or png accepted)
displayMode(optional) | Mode to display image ('mono', 'stereoTopBottom','stereoLeftRight'). 'mono' is the default mode.
rightController(optional) | gltf file containing right controller 3D model
leftController(optional) | gltf file containing left controller 3D model

To show controllers, you need to give the 3D model for each controller, you need to take in account handedness.


# Work in progress

* Working on firefox on desktop.


## LICENSE

MIT

