
<img width="2048" height="1122" alt="image" src="https://github.com/user-attachments/assets/ea3a7126-23c4-48f8-8568-9fa9940313bd" />



# Point Distance Measure 3.2

## PixInsight utility script for measuring pixel and angular distances

**Point Distance Measure 3.2** is an interactive PixInsight JavaScript/PJSR utility. It measures the distance in pixels between two points selected on an image and, where suitable image metadata are available, also determines the corresponding angular distance on the sky.

Measurement points can be selected with the mouse and refined by dragging or with the keyboard. The script can optionally snap the selected point automatically to the intensity-weighted center of a nearby star.

## Main features

- Direct selection of two points on the image.
- Calculation of pixel coordinates, X/Y offsets, and pixel distance.
- True **1:1 view**, where one original image pixel corresponds to one screen pixel.
- Zooming, zooming out, fit-to-window, and image navigation.
- Automatically stretched preview for linear images.
- Optional star-centroid snapping.
- Measurement points that can be dragged with the mouse.
- Subpixel fine adjustment using the keyboard.
- Live distance display before the second point is placed.
- True spherical angular-distance calculation for images with WCS.
- Determination of celestial position angle.
- Approximate angular-distance calculation from image metadata when WCS is unavailable.
- Display of results in the dialog box and in the PixInsight console.

## Starting the script

The script file name is:

`PointDistanceMeasure_v3_2.js`

It can be run directly as a script file in PixInsight or added permanently to the Scripts menu.

The script menu identifier is:

`Utilities > PointDistanceMeasure`

When launched, it uses the currently active image. Another image can also be selected or opened from the user interface.

## Selecting an image

### Use active image

Loads the currently active PixInsight image.

### Open image...

Opens a new image file. It can be used, for example, with FITS and XISF files, as well as with other image formats supported by PixInsight.

Next to the image name, the script displays:

- the width and height of the image in pixels;
- whether a usable WCS astrometric solution is available.

## Zooming and navigation

### Fit

Fits the entire image to the preview window.

### 1:1

Sets a true full-resolution view. One original image pixel corresponds to one screen pixel.

### + and −

Zooms in or out in predefined steps.

### Mouse wheel

Zooms in or out around the mouse-pointer position.

### Moving the image

The image can be panned by holding down the left or middle mouse button. If the click is made on a measurement marker, the left mouse button moves that point instead.

At higher magnifications, the script renders the visible image area directly from the original image data. The 1:1 view and higher magnifications are therefore not created by enlarging a reduced preview.

## Automatic preview stretch

The **Auto-stretch preview** option applies an automatic display stretch to the preview.

This is particularly useful for linear, unstretched astrophotography images. The stretch affects only the script preview and does not modify the original image.

## Star-centroid snapping

When **Snap to star centroid** is enabled, the script searches for the nearest reliably identifiable star peak around the click location and then determines its intensity-weighted center.

The **Radius** field specifies the search radius in original image pixels:

- minimum: 2 pixels;
- maximum: 20 pixels;
- default: 7 pixels.

If the script finds a suitable star, the point is moved automatically to its centroid. If no reliable star center is found, the original click location is used.

With an excessively large search radius, the point may snap to a nearby brighter star. A smaller radius is therefore recommended for close star pairs.

## Measuring with the mouse

1. Open or select an image.
2. Set the desired magnification.
3. Click the first measurement point. This becomes **P1**.
4. Move the mouse toward the second point.
5. The script displays the distance between P1 and the current mouse position in real time.
6. Click the second point. This becomes **P2**.
7. The measurement result is displayed automatically.

The first point is shown with a green marker and the second point with a red marker. The currently selected point is highlighted in white.

After the second point has been fixed, clicking a new location starts a new measurement. The new click becomes the new P1, and the following click becomes the new P2.

## Refining the measurement points

### Moving points with the mouse

Click the P1 or P2 marker and drag it to the desired position. The measurement result is updated continuously while the point is being moved.

If star-centroid snapping is enabled, the marker attempts to snap to the center of a nearby star after the mouse button is released.

### Moving points with the keyboard

Click the P1 or P2 marker, then use the arrow keys:

- **arrow key:** 1-pixel movement;
- **Shift + arrow key:** 0.1-pixel movement.

The script does not allow measurement points to be moved outside the image boundaries.

## Entering coordinates manually

The measurement-point coordinates can also be entered directly:

- X1, Y1;
- X2, Y2.

The **Measure / apply coordinates** button validates and applies the entered values.

The coordinates must remain within the valid image range:

- X: between 0 and image width − 1;
- Y: between 0 and image height − 1.

The **Clear points** button removes both measurement points and clears the current result.

## Displayed results

### For every image

The script displays:

- the pixel coordinates of P1 and P2;
- the offset in the X direction;
- the offset in the Y direction;
- the pixel distance between the two points;
- the direction in the image plane.

The image-plane direction is measured clockwise from the positive X axis.

### For images with WCS

The script uses PixInsight’s native image-to-celestial coordinate transformation separately for each measurement point.

It displays:

- the right ascension and declination of P1;
- the right ascension and declination of P2;
- the spherical great-circle distance between the two points;
- the distance in arcseconds, arcminutes, and degrees;
- the celestial position angle from P1 to P2;
- the average image scale along the selected segment.

The celestial position angle is measured from north through east.

The great-circle distance calculated from the actual celestial coordinates of the two points is more accurate than simply multiplying the pixel distance by a single average image scale. This is particularly important for large fields of view or noticeable geometric distortion.

### For images without WCS

If no usable native WCS transformation is available, the script attempts to determine an approximate image scale from the image metadata.

The data are searched in the following order:

1. WCS CD matrix:
   `CD1_1`, `CD1_2`, `CD2_1`, `CD2_2`
2. WCS image scale:
   `CDELT1`, `CDELT2`
3. Pixel size:
   for example `XPIXSZ`, `YPIXSZ`, `PIXSIZE`
4. Focal length:
   for example `FOCALLEN`, `FOCLEN`, `FOCALLENGTH`

When pixel size and focal length are available, the calculation is based on:

`image scale [arcseconds/pixel] = 206.264806 × pixel size [µm] / focal length [mm]`

The script clearly labels the resulting angular distance as an approximate value.

## Accuracy and limitations

- Measurement coordinates are handled with subpixel precision.
- The centroid function calculates an intensity-weighted center; it does not fit a complete PSF model.
- The centroid may be less reliable for saturated, blended, distorted, or nebulosity-embedded stars.
- With a large search radius, a nearby brighter star may be selected instead.
- The accuracy of WCS-based measurements depends on the accuracy of the astrometric solution.
- Angular distances derived from metadata without WCS are only approximate.
- The script handles one measurement segment at a time.
- Markers and the measurement line are shown only in the preview.
- The script does not modify the contents of the original image.

## Practical recommendations

### Measuring the distance between stars

- Enable **Snap to star centroid**.
- Start with a search radius of 5–8 pixels.
- Use at least 1:1 magnification.
- Verify that the marker has snapped to the intended star.

### Measuring a close double star

- Use a small centroid radius.
- Zoom to 2:1 or higher.
- Refine the points with Shift + arrow keys.

### Measuring a saturated or irregular object

- Disable centroid snapping.
- Position the point manually.
- Use keyboard-based subpixel fine adjustment.

### Obtaining an accurate angular distance on the sky

- Solve the image astrometrically in PixInsight beforehand.
- Verify that the script header shows `WCS: yes`.

## Troubleshooting

### No angular distance is displayed

The image does not contain a usable WCS solution, and the image scale cannot be determined from the metadata either.

Solve the image astrometrically, or ensure that pixel-size and focal-length metadata are present.

### The centroid snaps to the wrong star

Reduce the **Radius** value, zoom in further, and click closer to the center of the intended star.

### The centroid does not find a star

Carefully increase the search radius. For faint, diffuse, or saturated objects, disable centroid snapping.

### The preview updates more slowly at high magnification

At high magnification, the script renders the visible area directly from the original image data. This provides more accurate display, but it may require more processing for large images and large preview windows.

## Version and license

**Point Distance Measure 3.2**

The script’s interactive preview and automatic-stretch implementation is partly based on the approach used in the *Manual Image Solver Project*, under the MIT license terms included in the original source code.

The program does not modify the image. Use it at your own risk.
