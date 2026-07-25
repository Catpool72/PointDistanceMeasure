#feature-id    Utilities > PointDistanceMeasure
#feature-info  Interactive full-resolution pixel and WCS distance measurement with draggable points, live readout, and optional star-centroid snapping.

/*
 * The interactive preview and automatic-stretch approach in this script was
 * adapted in part from the Manual Image Solver Project (Copyright 2026),
 * distributed under the MIT License. Permission is hereby granted, free of
 * charge, to any person obtaining a copy of this software and associated
 * documentation files, to deal in the Software without restriction, subject
 * to inclusion of this copyright and permission notice. THE SOFTWARE IS
 * PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND.
 */

#include <pjsr/Sizer.jsh>
#include <pjsr/ButtonCodes.jsh>
#include <pjsr/FocusStyle.jsh>
#include <pjsr/KeyCodes.jsh>
#include <pjsr/StdButton.jsh>
#include <pjsr/StdIcon.jsh>
#include <pjsr/TextAlign.jsh>

#define SCRIPT_TITLE "Point Distance Measure"
#define SCRIPT_VERSION "3.2"
#define MAX_PREVIEW_EDGE 1600
#define DRAG_THRESHOLD 4
#define MARKER_HIT_RADIUS 14
#define HIGH_RES_ZOOM_THRESHOLD 0.75
#define DEFAULT_CENTROID_RADIUS 7

function trimString( s )
{
   return String( s ).replace( /^\s+|\s+$/g, "" );
}

function cleanFitsValue( v )
{
   if ( v === undefined || v === null )
      return "";

   var s = String( v );
   var slash = s.indexOf( "/" );
   if ( slash >= 0 )
      s = s.substring( 0, slash );

   s = trimString( s );

   if ( s.length >= 2 )
   {
      if ( (s.charAt( 0 ) == "'" && s.charAt( s.length - 1 ) == "'") ||
           (s.charAt( 0 ) == "\"" && s.charAt( s.length - 1 ) == "\"") )
         s = s.substring( 1, s.length - 1 );
   }

   return trimString( s );
}

function parseFitsNumber( v )
{
   var s = cleanFitsValue( v ).replace( /D/i, "E" );
   var x = parseFloat( s );
   return isNaN( x ) ? null : x;
}

function getKeywordMap( imgWin )
{
   var map = {};

   if ( imgWin === null || imgWin.isNull )
      return map;

   try
   {
      var keywords = imgWin.keywords;
      if ( keywords === undefined || keywords === null )
         return map;

      for ( var i = 0; i < keywords.length; ++i )
      {
         var k = keywords[i];
         if ( k && k.name !== undefined )
            map[String( k.name ).toUpperCase()] = k.value;
      }
   }
   catch ( e )
   {
   }

   return map;
}

function getNumberKeyword( map, names )
{
   for ( var i = 0; i < names.length; ++i )
   {
      var key = String( names[i] ).toUpperCase();
      if ( map.hasOwnProperty( key ) )
      {
         var v = parseFitsNumber( map[key] );
         if ( v !== null )
            return v;
      }
   }
   return null;
}

function getArcsecPerPixelFromMetadata( imgWin )
{
   var kw = getKeywordMap( imgWin );

   var cd11 = getNumberKeyword( kw, ["CD1_1"] );
   var cd12 = getNumberKeyword( kw, ["CD1_2"] );
   var cd21 = getNumberKeyword( kw, ["CD2_1"] );
   var cd22 = getNumberKeyword( kw, ["CD2_2"] );

   if ( cd11 !== null && cd12 !== null && cd21 !== null && cd22 !== null )
   {
      var scaleXdeg = Math.sqrt( cd11*cd11 + cd21*cd21 );
      var scaleYdeg = Math.sqrt( cd12*cd12 + cd22*cd22 );
      var scaleDeg = (Math.abs( scaleXdeg ) + Math.abs( scaleYdeg ))/2;
      if ( scaleDeg > 0 )
         return { arcsecPerPixel: scaleDeg*3600, source: "WCS CD matrix (approximate average scale)" };
   }

   var cdelt1 = getNumberKeyword( kw, ["CDELT1"] );
   var cdelt2 = getNumberKeyword( kw, ["CDELT2"] );

   if ( cdelt1 !== null && cdelt2 !== null )
   {
      var scaleDeg2 = (Math.abs( cdelt1 ) + Math.abs( cdelt2 ))/2;
      if ( scaleDeg2 > 0 )
         return { arcsecPerPixel: scaleDeg2*3600, source: "WCS CDELT keywords (approximate average scale)" };
   }

   if ( cdelt1 !== null && Math.abs( cdelt1 ) > 0 )
      return { arcsecPerPixel: Math.abs( cdelt1 )*3600, source: "WCS CDELT1 keyword (approximate)" };

   if ( cdelt2 !== null && Math.abs( cdelt2 ) > 0 )
      return { arcsecPerPixel: Math.abs( cdelt2 )*3600, source: "WCS CDELT2 keyword (approximate)" };

   var pixelSizeUm = getNumberKeyword( kw, ["XPIXSZ", "YPIXSZ", "PIXSIZE", "PIXSZ", "PIXELSIZE"] );
   var focalLengthMm = getNumberKeyword( kw, ["FOCALLEN", "FOCUS", "FOCLEN", "FOCALLENGTH"] );

   if ( pixelSizeUm !== null && focalLengthMm !== null && focalLengthMm > 0 )
      return {
         arcsecPerPixel: 206.26480624709636*pixelSizeUm/focalLengthMm,
         source: "pixel size plus focal length (approximate)"
      };

   return null;
}

function formatNumber( x, decimals )
{
   if ( x === null || x === undefined || isNaN( x ) )
      return "n/a";
   return format( "%.*f", decimals, x );
}

function imageName( imgWin )
{
   if ( imgWin === null || imgWin.isNull )
      return "No active image";

   try
   {
      if ( imgWin.mainView !== undefined && imgWin.mainView !== null )
         return imgWin.mainView.id;
   }
   catch ( e )
   {
   }

   return "Opened image";
}

function hasWCS( imgWin )
{
   if ( imgWin === null || imgWin.isNull )
      return false;

   try
   {
      return imgWin.hasAstrometricSolution;
   }
   catch ( e )
   {
      return false;
   }
}

function imageInfoText( imgWin )
{
   if ( imgWin === null || imgWin.isNull )
      return "No image selected.";

   var image = imgWin.mainView.image;
   return "Image: " + imageName( imgWin ) +
          "   (" + image.width + " x " + image.height + " px)" +
          "   WCS: " + (hasWCS( imgWin ) ? "yes" : "no");
}

function openImageFile()
{
   var ofd = new OpenFileDialog;
   ofd.caption = "Open FITS or XISF image";
   ofd.loadImageFilters();

   if ( !ofd.execute() )
      return null;

   var wins = ImageWindow.open( ofd.fileName );

   if ( wins.length < 1 )
   {
      new MessageBox( "The image could not be opened.", SCRIPT_TITLE,
                      StdIcon_Error, StdButton_Ok ).execute();
      return null;
   }

   return wins[0];
}

function clamp01( x )
{
   return Math.max( 0, Math.min( 1, x ) );
}

function midtonesTransferFunction( m, x )
{
   if ( x <= 0 ) return 0;
   if ( x >= 1 ) return 1;
   if ( m <= 0 ) return 0;
   if ( m >= 1 ) return 1;
   if ( Math.abs( m - 0.5 ) < 1.0e-12 ) return x;
   return ((m - 1)*x)/((2*m - 1)*x - m);
}

function computeAutoSTF( image, channel )
{
   var savedChannel = image.selectedChannel;
   var median = 0;
   var mad = 0;

   try
   {
      image.selectedChannel = channel;
      median = image.median();
      try
      {
         mad = image.MAD();
      }
      catch ( e1 )
      {
         mad = image.avgDev()*1.4826;
      }
   }
   finally
   {
      image.selectedChannel = savedChannel;
   }

   if ( !isFinite( median ) || !isFinite( mad ) || mad < 1.0e-15 )
      return { shadow: 0, midtone: 0.5 };

   var shadow = Math.max( 0, median - 2.8*mad );
   var normalizedMedian = clamp01( (median - shadow)/(1 - shadow) );
   normalizedMedian = Math.max( 1.0e-6, Math.min( 1 - 1.0e-6, normalizedMedian ) );

   var targetMedian = 0.25;
   var m = ((targetMedian - 1)*normalizedMedian)/
           ((2*targetMedian - 1)*normalizedMedian - targetMedian);

   return { shadow: shadow, midtone: clamp01( m ) };
}

function prepareStretchData( image, autoStretch )
{
   var isColor = image.numberOfChannels >= 3;
   var stfR = null;
   var stfG = null;
   var stfB = null;

   if ( autoStretch )
   {
      stfR = computeAutoSTF( image, 0 );
      stfG = isColor ? computeAutoSTF( image, 1 ) : stfR;
      stfB = isColor ? computeAutoSTF( image, 2 ) : stfR;
   }

   return { isColor: isColor, r: stfR, g: stfG, b: stfB };
}

function stretchedSample( value, stf, autoStretch )
{
   if ( !autoStretch )
      return clamp01( value );

   var denominator = 1 - stf.shadow;
   if ( denominator <= 1.0e-15 )
      return clamp01( value );

   return midtonesTransferFunction( stf.midtone,
      clamp01( (value - stf.shadow)/denominator ) );
}

function sampleARGB( image, x, y, autoStretch, stretchData )
{
   var r, g, b;

   if ( stretchData.isColor )
   {
      r = image.sample( x, y, 0 );
      g = image.sample( x, y, 1 );
      b = image.sample( x, y, 2 );
   }
   else
   {
      r = g = b = image.sample( x, y, 0 );
   }

   r = stretchedSample( r, stretchData.r, autoStretch );
   g = stretchedSample( g, stretchData.g, autoStretch );
   b = stretchedSample( b, stretchData.b, autoStretch );

   var ri = Math.round( 255*r );
   var gi = Math.round( 255*g );
   var bi = Math.round( 255*b );
   return 0xFF000000 | (ri << 16) | (gi << 8) | bi;
}

function createPreviewBitmap( imgWin, autoStretch )
{
   var image = imgWin.mainView.image;
   var w = image.width;
   var h = image.height;
   var maxDim = Math.max( w, h );
   var scale = maxDim > MAX_PREVIEW_EDGE ? MAX_PREVIEW_EDGE/maxDim : 1;
   var bmpW = Math.max( 1, Math.round( w*scale ) );
   var bmpH = Math.max( 1, Math.round( h*scale ) );
   var bitmap = new Bitmap( bmpW, bmpH );
   var stretchData = prepareStretchData( image, autoStretch );

   for ( var by = 0; by < bmpH; ++by )
   {
      var iy = Math.min( h - 1, Math.floor( by/scale ) );

      for ( var bx = 0; bx < bmpW; ++bx )
      {
         var ix = Math.min( w - 1, Math.floor( bx/scale ) );
         bitmap.setPixel( bx, by, sampleARGB( image, ix, iy, autoStretch, stretchData ) );
      }
   }

   return {
      bitmap: bitmap,
      scale: scale,
      imageWidth: w,
      imageHeight: h,
      autoStretch: autoStretch,
      stretchData: stretchData
   };
}

function createImageRegionBitmap( imgWin, x0, y0, x1, y1, autoStretch, stretchData )
{
   if ( imgWin === null || imgWin.isNull )
      return null;

   var image = imgWin.mainView.image;
   x0 = Math.max( 0, Math.min( image.width, Math.floor( x0 ) ) );
   y0 = Math.max( 0, Math.min( image.height, Math.floor( y0 ) ) );
   x1 = Math.max( x0 + 1, Math.min( image.width, Math.ceil( x1 ) ) );
   y1 = Math.max( y0 + 1, Math.min( image.height, Math.ceil( y1 ) ) );

   var bitmap = new Bitmap( x1 - x0, y1 - y0 );
   for ( var y = y0; y < y1; ++y )
      for ( var x = x0; x < x1; ++x )
         bitmap.setPixel( x - x0, y - y0,
                          sampleARGB( image, x, y, autoStretch, stretchData ) );

   return { bitmap: bitmap, x0: x0, y0: y0, x1: x1, y1: y1 };
}

function MeasurementPreview( parent )
{
   this.__base__ = ScrollBox;
   this.__base__( parent );

   var self = this;

   this.imgWin = null;
   this.bitmap = null;
   this.bitmapScale = 1;
   this.imageWidth = 0;
   this.imageHeight = 0;
   this.autoStretch = true;
   this.stretchData = null;
   this.zoomLevel = 1; // Screen pixels per original image pixel.
   this.zoomLevels = [0.03125, 0.04167, 0.0625, 0.08333, 0.125, 0.16667,
                      0.25, 0.33333, 0.5, 0.66667, 0.75, 1, 1.25, 1.5,
                      2, 2.5, 3, 4, 5, 6, 8, 10, 12, 16];
   this.scrollX = 0;
   this.scrollY = 0;
   this.maxScrollX = 0;
   this.maxScrollY = 0;
   this.point1 = null;
   this.point2 = null;
   this.hoverPoint = null;
   this.selectedPoint = 0;

   this.onImageClick = null;
   this.onPointMoved = null;
   this.onPointSelected = null;
   this.onHoverPoint = null;
   this.onZoomChanged = null;
   this.onNudgePoint = null;

   this.isDragging = false;
   this.hasMoved = false;
   this.dragMode = "none";
   this.dragPointIndex = 0;
   this.dragStartX = 0;
   this.dragStartY = 0;
   this.panScrollX = 0;
   this.panScrollY = 0;

   this.highResTile = null;
   this.highResKey = "";

   this.autoScrolls = false;
   this.viewport.focusStyle = FocusStyle_Click | FocusStyle_Tab;

   this.onHorizontalScrollPosUpdated = function( pos )
   {
      self.scrollX = pos;
      self.invalidateHighResTile();
      self.viewport.update();
   };

   this.onVerticalScrollPosUpdated = function( pos )
   {
      self.scrollY = pos;
      self.invalidateHighResTile();
      self.viewport.update();
   };

   this.viewport.onPaint = function()
   {
      var g = new Graphics( this );
      g.fillRect( this.boundsRect, new Brush( 0xFF202020 ) );

      if ( self.bitmap !== null && self.imageWidth > 0 && self.imageHeight > 0 )
      {
         var dispW = Math.round( self.imageWidth*self.zoomLevel );
         var dispH = Math.round( self.imageHeight*self.zoomLevel );

         // Fast overview image, always available while panning and zooming.
         g.drawScaledBitmap( new Rect( -self.scrollX, -self.scrollY,
                                       dispW - self.scrollX, dispH - self.scrollY ),
                             self.bitmap );

         // At useful inspection zooms, overlay a tile rendered directly from the
         // original image. This gives a real one-image-pixel to one-screen-pixel
         // representation at zoom 1:1, without allocating a full-resolution bitmap.
         if ( self.zoomLevel >= HIGH_RES_ZOOM_THRESHOLD && !self.isDragging )
         {
            var tile = self.getHighResolutionTile();
            if ( tile !== null )
            {
               var tx0 = tile.x0*self.zoomLevel - self.scrollX;
               var ty0 = tile.y0*self.zoomLevel - self.scrollY;
               var tx1 = tile.x1*self.zoomLevel - self.scrollX;
               var ty1 = tile.y1*self.zoomLevel - self.scrollY;
               g.drawScaledBitmap( new Rect( tx0, ty0, tx1, ty1 ), tile.bitmap );
            }
         }

         var screenPoint = function( p )
         {
            return {
               x: p.x*self.zoomLevel - self.scrollX,
               y: p.y*self.zoomLevel - self.scrollY
            };
         };

         var segmentEnd = self.point2;
         var temporarySegment = false;
         if ( segmentEnd === null && self.point1 !== null && self.hoverPoint !== null )
         {
            segmentEnd = self.hoverPoint;
            temporarySegment = true;
         }

         if ( self.point1 !== null && segmentEnd !== null )
         {
            var a = screenPoint( self.point1 );
            var b = screenPoint( segmentEnd );
            g.pen = new Pen( temporarySegment ? 0xB0FFFF00 : 0xE6FFFF00,
                             temporarySegment ? 1 : 2 );
            g.drawLine( a.x, a.y, b.x, b.y );
         }

         var drawMarker = function( p, color, label, selected )
         {
            if ( p === null )
               return;

            var q = screenPoint( p );
            var r = selected ? 11 : 9;
            g.pen = new Pen( selected ? 0xFFFFFFFF : color, selected ? 3 : 2 );
            g.drawCircle( q.x, q.y, r );
            g.drawLine( q.x - r - 4, q.y, q.x + r + 4, q.y );
            g.drawLine( q.x, q.y - r - 4, q.x, q.y + r + 4 );
            g.font = new Font( "Helvetica", 10 );
            g.drawText( q.x + 12, q.y - 10, label );
         };

         drawMarker( self.point1, 0xFF00FF66, "P1", self.selectedPoint === 1 );
         drawMarker( self.point2, 0xFFFF5555, "P2", self.selectedPoint === 2 );
      }

      g.end();
   };

   this.viewport.onMousePress = function( x, y, button, buttonState, modifiers )
   {
      if ( self.bitmap === null )
         return;

      if ( button === MouseButton_Left )
      {
         var hit = self.hitTestPoint( x, y );
         if ( hit !== 0 )
         {
            self.isDragging = true;
            self.hasMoved = false;
            self.dragMode = "point";
            self.dragPointIndex = hit;
            self.setSelectedPoint( hit );
            return;
         }
      }

      if ( button === MouseButton_Left || button === MouseButton_Middle )
      {
         self.isDragging = true;
         self.hasMoved = false;
         self.dragMode = "pan";
         self.dragStartX = x;
         self.dragStartY = y;
         self.panScrollX = self.scrollX;
         self.panScrollY = self.scrollY;
      }
   };

   this.viewport.onMouseMove = function( x, y, buttonState, modifiers )
   {
      if ( self.bitmap === null )
         return;

      if ( self.isDragging )
      {
         if ( self.dragMode === "point" )
         {
            self.hasMoved = true;
            var p = self.screenToImage( x, y, true );
            if ( self.dragPointIndex === 1 )
               self.point1 = p;
            else
               self.point2 = p;

            if ( self.onPointMoved !== null )
               self.onPointMoved( self.dragPointIndex, p, false );
            self.viewport.update();
            return;
         }

         var dx = x - self.dragStartX;
         var dy = y - self.dragStartY;

         if ( !self.hasMoved &&
              (Math.abs( dx ) > DRAG_THRESHOLD || Math.abs( dy ) > DRAG_THRESHOLD) )
            self.hasMoved = true;

         if ( self.hasMoved )
            self.setScroll( self.panScrollX - dx, self.panScrollY - dy );
         return;
      }

      var hover = self.screenToImage( x, y, false );
      if ( hover !== null )
      {
         self.hoverPoint = hover;
         if ( self.onHoverPoint !== null )
            self.onHoverPoint( hover );
      }
      else
      {
         self.hoverPoint = null;
         if ( self.onHoverPoint !== null )
            self.onHoverPoint( null );
      }
      self.viewport.update();
   };

   this.viewport.onMouseRelease = function( x, y, button, buttonState, modifiers )
   {
      if ( !self.isDragging )
         return;

      if ( self.dragMode === "point" )
      {
         var p = self.dragPointIndex === 1 ? self.point1 : self.point2;
         self.isDragging = false;
         self.dragMode = "none";
         self.invalidateHighResTile();
         if ( self.onPointMoved !== null )
            self.onPointMoved( self.dragPointIndex, p, true );
         self.viewport.update();
         return;
      }

      if ( !self.hasMoved && button === MouseButton_Left )
      {
         var imagePoint = self.screenToImage( x, y, false );
         if ( imagePoint !== null && self.onImageClick !== null )
            self.onImageClick( imagePoint.x, imagePoint.y );
      }

      self.isDragging = false;
      self.hasMoved = false;
      self.dragMode = "none";
      self.invalidateHighResTile();
      self.viewport.update();
   };

   this.viewport.onMouseWheel = function( x, y, delta, buttonState, modifiers )
   {
      if ( self.bitmap === null )
         return;

      var oldZoom = self.zoomLevel;
      var newZoom = oldZoom;

      if ( delta > 0 )
      {
         for ( var i = 0; i < self.zoomLevels.length; ++i )
            if ( self.zoomLevels[i] > oldZoom + 1.0e-6 )
            {
               newZoom = self.zoomLevels[i];
               break;
            }
      }
      else
      {
         for ( var j = self.zoomLevels.length - 1; j >= 0; --j )
            if ( self.zoomLevels[j] < oldZoom - 1.0e-6 )
            {
               newZoom = self.zoomLevels[j];
               break;
            }
      }

      if ( Math.abs( newZoom - oldZoom ) < 1.0e-12 )
         return;

      var factor = newZoom/oldZoom;
      self.scrollX = Math.round( (self.scrollX + x)*factor - x );
      self.scrollY = Math.round( (self.scrollY + y)*factor - y );
      self.zoomLevel = newZoom;
      self.invalidateHighResTile();
      self.updateViewport();
      self.notifyZoomChanged();
   };

   this.viewport.onKeyPress = function( keyCode, modifiers )
   {
      if ( self.selectedPoint === 0 )
         return false;

      var dx = 0;
      var dy = 0;
      if ( keyCode === Key_Left ) dx = -1;
      else if ( keyCode === Key_Right ) dx = 1;
      else if ( keyCode === Key_Up ) dy = -1;
      else if ( keyCode === Key_Down ) dy = 1;
      else return false;

      var step = (modifiers & KeyModifier_Shift) !== 0 ? 0.1 : 1.0;
      if ( self.onNudgePoint !== null )
         self.onNudgePoint( self.selectedPoint, dx*step, dy*step );
      return true;
   };

   this.viewport.onResize = function()
   {
      self.invalidateHighResTile();
      self.updateViewport();
   };
}

MeasurementPreview.prototype = new ScrollBox;

MeasurementPreview.prototype.setImageData = function( imgWin, bitmapResult )
{
   this.imgWin = imgWin;
   this.bitmap = bitmapResult.bitmap;
   this.bitmapScale = bitmapResult.scale;
   this.imageWidth = bitmapResult.imageWidth;
   this.imageHeight = bitmapResult.imageHeight;
   this.autoStretch = bitmapResult.autoStretch;
   this.stretchData = bitmapResult.stretchData;
   this.scrollX = 0;
   this.scrollY = 0;
   this.invalidateHighResTile();
   this.updateViewport();
};

MeasurementPreview.prototype.setPoints = function( p1, p2 )
{
   this.point1 = p1;
   this.point2 = p2;
   if ( p2 !== null )
      this.hoverPoint = null;
   this.viewport.update();
};

MeasurementPreview.prototype.setSelectedPoint = function( index )
{
   this.selectedPoint = index;
   if ( this.onPointSelected !== null )
      this.onPointSelected( index );
   this.viewport.update();
};

MeasurementPreview.prototype.screenToImage = function( x, y, clampToImage )
{
   if ( this.imageWidth <= 0 || this.imageHeight <= 0 || this.zoomLevel <= 0 )
      return null;

   var px = (x + this.scrollX)/this.zoomLevel;
   var py = (y + this.scrollY)/this.zoomLevel;

   if ( clampToImage )
   {
      px = Math.max( 0, Math.min( this.imageWidth - 1, px ) );
      py = Math.max( 0, Math.min( this.imageHeight - 1, py ) );
      return { x: px, y: py };
   }

   if ( px < 0 || py < 0 || px > this.imageWidth - 1 || py > this.imageHeight - 1 )
      return null;
   return { x: px, y: py };
};

MeasurementPreview.prototype.pointToScreen = function( p )
{
   return {
      x: p.x*this.zoomLevel - this.scrollX,
      y: p.y*this.zoomLevel - this.scrollY
   };
};

MeasurementPreview.prototype.hitTestPoint = function( x, y )
{
   var best = 0;
   var bestDistance = MARKER_HIT_RADIUS + 1;
   var points = [this.point1, this.point2];

   for ( var i = 0; i < points.length; ++i )
      if ( points[i] !== null )
      {
         var q = this.pointToScreen( points[i] );
         var d = Math.sqrt( (q.x - x)*(q.x - x) + (q.y - y)*(q.y - y) );
         if ( d <= MARKER_HIT_RADIUS && d < bestDistance )
         {
            best = i + 1;
            bestDistance = d;
         }
      }

   return best;
};

MeasurementPreview.prototype.invalidateHighResTile = function()
{
   this.highResTile = null;
   this.highResKey = "";
};

MeasurementPreview.prototype.getHighResolutionTile = function()
{
   if ( this.imgWin === null || this.imgWin.isNull || this.zoomLevel <= 0 )
      return null;

   var viewW = this.viewport.width > 0 ? this.viewport.width : this.width;
   var viewH = this.viewport.height > 0 ? this.viewport.height : this.height;
   var margin = 2;
   var x0 = Math.max( 0, Math.floor( this.scrollX/this.zoomLevel ) - margin );
   var y0 = Math.max( 0, Math.floor( this.scrollY/this.zoomLevel ) - margin );
   var x1 = Math.min( this.imageWidth,
                      Math.ceil( (this.scrollX + viewW)/this.zoomLevel ) + margin );
   var y1 = Math.min( this.imageHeight,
                      Math.ceil( (this.scrollY + viewH)/this.zoomLevel ) + margin );

   if ( x1 <= x0 || y1 <= y0 )
      return null;

   var key = x0 + ":" + y0 + ":" + x1 + ":" + y1 + ":" +
             (this.autoStretch ? "1" : "0");
   if ( this.highResTile !== null && this.highResKey === key )
      return this.highResTile;

   try
   {
      this.highResTile = createImageRegionBitmap( this.imgWin, x0, y0, x1, y1,
                                                  this.autoStretch, this.stretchData );
      this.highResKey = key;
      return this.highResTile;
   }
   catch ( e )
   {
      Console.warningln( "<end><cbr>High-resolution preview tile failed: ", e.toString() );
      this.highResTile = null;
      this.highResKey = "";
      return null;
   }
};

MeasurementPreview.prototype.setScroll = function( x, y )
{
   this.scrollX = Math.max( 0, Math.min( this.maxScrollX, Math.round( x ) ) );
   this.scrollY = Math.max( 0, Math.min( this.maxScrollY, Math.round( y ) ) );
   this.horizontalScrollPosition = this.scrollX;
   this.verticalScrollPosition = this.scrollY;
   this.invalidateHighResTile();
   this.viewport.update();
};

MeasurementPreview.prototype.updateViewport = function()
{
   if ( this.bitmap === null )
      return;

   var dispW = Math.round( this.imageWidth*this.zoomLevel );
   var dispH = Math.round( this.imageHeight*this.zoomLevel );
   var viewW = this.viewport.width > 0 ? this.viewport.width : this.width;
   var viewH = this.viewport.height > 0 ? this.viewport.height : this.height;

   this.maxScrollX = Math.max( 0, dispW - viewW );
   this.maxScrollY = Math.max( 0, dispH - viewH );
   this.scrollX = Math.max( 0, Math.min( this.maxScrollX, this.scrollX ) );
   this.scrollY = Math.max( 0, Math.min( this.maxScrollY, this.scrollY ) );

   this.setHorizontalScrollRange( 0, this.maxScrollX );
   this.setVerticalScrollRange( 0, this.maxScrollY );
   this.horizontalScrollPosition = this.scrollX;
   this.verticalScrollPosition = this.scrollY;
   this.viewport.update();
};

MeasurementPreview.prototype.notifyZoomChanged = function()
{
   if ( this.onZoomChanged !== null )
      this.onZoomChanged( this.zoomLevel );
};

MeasurementPreview.prototype.fitToWindow = function()
{
   if ( this.bitmap === null || this.imageWidth <= 0 || this.imageHeight <= 0 )
      return;

   var viewW = this.viewport.width > 0 ? this.viewport.width : this.width;
   var viewH = this.viewport.height > 0 ? this.viewport.height : this.height;
   if ( viewW <= 0 || viewH <= 0 )
      return;

   this.zoomLevel = Math.min( viewW/this.imageWidth, viewH/this.imageHeight );
   this.scrollX = 0;
   this.scrollY = 0;
   this.invalidateHighResTile();
   this.updateViewport();
   this.notifyZoomChanged();
};

MeasurementPreview.prototype.zoomAroundCenter = function( newZoom )
{
   if ( this.bitmap === null || newZoom <= 0 )
      return;

   var oldZoom = this.zoomLevel;
   var viewW = this.viewport.width > 0 ? this.viewport.width : this.width;
   var viewH = this.viewport.height > 0 ? this.viewport.height : this.height;
   var centerX = this.scrollX + viewW/2;
   var centerY = this.scrollY + viewH/2;
   var factor = newZoom/oldZoom;

   this.scrollX = Math.round( centerX*factor - viewW/2 );
   this.scrollY = Math.round( centerY*factor - viewH/2 );
   this.zoomLevel = newZoom;
   this.invalidateHighResTile();
   this.updateViewport();
   this.notifyZoomChanged();
};

MeasurementPreview.prototype.zoom11 = function()
{
   this.zoomAroundCenter( 1 );
};

MeasurementPreview.prototype.zoomIn = function()
{
   for ( var i = 0; i < this.zoomLevels.length; ++i )
      if ( this.zoomLevels[i] > this.zoomLevel + 1.0e-6 )
      {
         this.zoomAroundCenter( this.zoomLevels[i] );
         return;
      }
};

MeasurementPreview.prototype.zoomOut = function()
{
   for ( var i = this.zoomLevels.length - 1; i >= 0; --i )
      if ( this.zoomLevels[i] < this.zoomLevel - 1.0e-6 )
      {
         this.zoomAroundCenter( this.zoomLevels[i] );
         return;
      }
};

function imageToCelestialSafe( imgWin, x, y )
{
   if ( !hasWCS( imgWin ) )
      return null;

   try
   {
      var p = imgWin.imageToCelestial( new Point( x, y ) );
      if ( p === null || p === undefined || !isFinite( p.x ) || !isFinite( p.y ) )
         return null;
      return { ra: p.x, dec: p.y };
   }
   catch ( e )
   {
      return null;
   }
}

function greatCircleDistanceDegrees( c1, c2 )
{
   var d2r = Math.PI/180;
   var dec1 = c1.dec*d2r;
   var dec2 = c2.dec*d2r;
   var dDec = dec2 - dec1;
   var dRA = (c2.ra - c1.ra)*d2r;

   while ( dRA > Math.PI ) dRA -= 2*Math.PI;
   while ( dRA < -Math.PI ) dRA += 2*Math.PI;

   var sd = Math.sin( dDec/2 );
   var sr = Math.sin( dRA/2 );
   var a = sd*sd + Math.cos( dec1 )*Math.cos( dec2 )*sr*sr;
   a = Math.max( 0, Math.min( 1, a ) );
   return 2*Math.atan2( Math.sqrt( a ), Math.sqrt( 1 - a ) )/d2r;
}

function positionAngleDegrees( c1, c2 )
{
   var d2r = Math.PI/180;
   var dec1 = c1.dec*d2r;
   var dec2 = c2.dec*d2r;
   var dRA = (c2.ra - c1.ra)*d2r;

   while ( dRA > Math.PI ) dRA -= 2*Math.PI;
   while ( dRA < -Math.PI ) dRA += 2*Math.PI;

   var y = Math.sin( dRA )*Math.cos( dec2 );
   var x = Math.cos( dec1 )*Math.sin( dec2 ) -
           Math.sin( dec1 )*Math.cos( dec2 )*Math.cos( dRA );
   var pa = Math.atan2( y, x )/d2r;
   return pa < 0 ? pa + 360 : pa;
}

function raToHMS( raDeg )
{
   var ra = raDeg;
   while ( ra < 0 ) ra += 360;
   while ( ra >= 360 ) ra -= 360;

   var totalSeconds = ra*240;
   var h = Math.floor( totalSeconds/3600 );
   totalSeconds -= h*3600;
   var m = Math.floor( totalSeconds/60 );
   var s = totalSeconds - m*60;

   return format( "%02d:%02d:%06.3f", h, m, s );
}

function decToDMS( decDeg )
{
   var sign = decDeg < 0 ? "-" : "+";
   var totalSeconds = Math.abs( decDeg )*3600;
   var d = Math.floor( totalSeconds/3600 );
   totalSeconds -= d*3600;
   var m = Math.floor( totalSeconds/60 );
   var s = totalSeconds - m*60;

   return sign + format( "%02d:%02d:%05.2f", d, m, s );
}

function pointInImage( image, p )
{
   return p !== null && isFinite( p.x ) && isFinite( p.y ) &&
          p.x >= 0 && p.y >= 0 && p.x <= image.width - 1 && p.y <= image.height - 1;
}

function medianOfArray( values )
{
   if ( values.length < 1 )
      return 0;

   values.sort( function( a, b ) { return a - b; } );
   var m = Math.floor( values.length/2 );
   return (values.length & 1) ? values[m] : (values[m - 1] + values[m])/2;
}

function luminanceSample( image, x, y )
{
   if ( image.numberOfChannels >= 3 )
      return 0.2126*image.sample( x, y, 0 ) +
             0.7152*image.sample( x, y, 1 ) +
             0.0722*image.sample( x, y, 2 );
   return image.sample( x, y, 0 );
}

function findStarCentroid( imgWin, x, y, searchRadius )
{
   var unsnapped = { x: x, y: y, snapped: false, shift: 0 };
   if ( imgWin === null || imgWin.isNull )
      return unsnapped;

   var image = imgWin.mainView.image;
   var radius = Math.max( 2, Math.round( searchRadius ) );
   var cx = Math.max( 0, Math.min( image.width - 1, Math.round( x ) ) );
   var cy = Math.max( 0, Math.min( image.height - 1, Math.round( y ) ) );
   var x0 = Math.max( 0, cx - radius );
   var y0 = Math.max( 0, cy - radius );
   var x1 = Math.min( image.width - 1, cx + radius );
   var y1 = Math.min( image.height - 1, cy + radius );

   var border = [];
   var peak = -Infinity;
   var peakX = cx;
   var peakY = cy;

   for ( var yy = y0; yy <= y1; ++yy )
      for ( var xx = x0; xx <= x1; ++xx )
      {
         var v = luminanceSample( image, xx, yy );
         if ( v > peak )
         {
            peak = v;
            peakX = xx;
            peakY = yy;
         }
         if ( xx === x0 || xx === x1 || yy === y0 || yy === y1 )
            border.push( v );
      }

   if ( border.length < 4 || !isFinite( peak ) )
      return unsnapped;

   var background = medianOfArray( border.slice( 0 ) );
   var deviations = [];
   for ( var i = 0; i < border.length; ++i )
      deviations.push( Math.abs( border[i] - background ) );
   var noise = 1.4826*medianOfArray( deviations );
   var contrast = peak - background;

   if ( !isFinite( contrast ) || contrast <= Math.max( 3*noise, 1.0e-8 ) )
      return unsnapped;

   var centroidRadius = Math.max( 2, Math.min( 5, Math.floor( radius/2 ) + 1 ) );
   var centerX = peakX;
   var centerY = peakY;
   var threshold = background + Math.max( 2*noise, 0.05*contrast );

   for ( var iteration = 0; iteration < 3; ++iteration )
   {
      var wx0 = Math.max( 0, Math.floor( centerX ) - centroidRadius );
      var wy0 = Math.max( 0, Math.floor( centerY ) - centroidRadius );
      var wx1 = Math.min( image.width - 1, Math.floor( centerX ) + centroidRadius );
      var wy1 = Math.min( image.height - 1, Math.floor( centerY ) + centroidRadius );
      var sum = 0;
      var sumX = 0;
      var sumY = 0;

      for ( var sy = wy0; sy <= wy1; ++sy )
         for ( var sx = wx0; sx <= wx1; ++sx )
         {
            var weight = luminanceSample( image, sx, sy ) - threshold;
            if ( weight > 0 )
            {
               sum += weight;
               sumX += sx*weight;
               sumY += sy*weight;
            }
         }

      if ( sum <= 1.0e-15 )
         return unsnapped;

      var newX = sumX/sum;
      var newY = sumY/sum;
      if ( Math.abs( newX - centerX ) < 0.001 &&
           Math.abs( newY - centerY ) < 0.001 )
      {
         centerX = newX;
         centerY = newY;
         break;
      }
      centerX = newX;
      centerY = newY;
   }

   var shift = Math.sqrt( (centerX - x)*(centerX - x) +
                          (centerY - y)*(centerY - y) );
   if ( !isFinite( centerX ) || !isFinite( centerY ) || shift > 1.75*radius )
      return unsnapped;

   return {
      x: Math.max( 0, Math.min( image.width - 1, centerX ) ),
      y: Math.max( 0, Math.min( image.height - 1, centerY ) ),
      snapped: true,
      shift: shift,
      peak: peak,
      background: background,
      noise: noise
   };
}

function PointDistanceDialog()
{
   this.__base__ = Dialog;
   this.__base__();

   var self = this;

   this.imgWin = ImageWindow.activeWindow;
   this.point1 = null;
   this.point2 = null;
   this.nextPoint = 1;
   this.selectedPoint = 0;

   this.titleLabel = new Label( this );
   this.titleLabel.text = "Click two points, drag existing markers, or refine the selected point with arrow keys.";
   this.titleLabel.textAlignment = TextAlign_Center;

   this.imageLabel = new Label( this );
   this.imageLabel.text = imageInfoText( this.imgWin );

   this.activeButton = new PushButton( this );
   this.activeButton.text = "Use active image";
   this.activeButton.onClick = function()
   {
      var w = ImageWindow.activeWindow;
      if ( w === null || w.isNull )
      {
         new MessageBox( "There is no active image window.", SCRIPT_TITLE,
                         StdIcon_Error, StdButton_Ok ).execute();
         return;
      }
      self.setImage( w );
   };

   this.openButton = new PushButton( this );
   this.openButton.text = "Open image...";
   this.openButton.onClick = function()
   {
      var w = openImageFile();
      if ( w !== null && !w.isNull )
         self.setImage( w );
   };

   this.autoStretchCheck = new CheckBox( this );
   this.autoStretchCheck.text = "Auto-stretch preview";
   this.autoStretchCheck.checked = true;
   this.autoStretchCheck.onCheck = function()
   {
      if ( self.imgWin !== null && !self.imgWin.isNull )
         self.rebuildPreview();
   };

   this.centroidCheck = new CheckBox( this );
   this.centroidCheck.text = "Snap to star centroid";
   this.centroidCheck.checked = true;
   this.centroidCheck.toolTip = "When a point is clicked or dragged, find the intensity-weighted center of the nearest star.";

   this.centroidRadiusLabel = new Label( this );
   this.centroidRadiusLabel.text = "Radius:";

   this.centroidRadiusSpin = new SpinBox( this );
   this.centroidRadiusSpin.setRange( 2, 20 );
   this.centroidRadiusSpin.value = DEFAULT_CENTROID_RADIUS;
   this.centroidRadiusSpin.toolTip = "Star search radius in original image pixels.";
   this.centroidRadiusSpin.setFixedWidth( 60 );

   this.fitButton = new PushButton( this );
   this.fitButton.text = "Fit";
   this.fitButton.onClick = function() { self.preview.fitToWindow(); };

   this.zoom11Button = new PushButton( this );
   this.zoom11Button.text = "1:1";
   this.zoom11Button.onClick = function() { self.preview.zoom11(); };

   this.zoomInButton = new PushButton( this );
   this.zoomInButton.text = "+";
   this.zoomInButton.onClick = function() { self.preview.zoomIn(); };

   this.zoomOutButton = new PushButton( this );
   this.zoomOutButton.text = "-";
   this.zoomOutButton.onClick = function() { self.preview.zoomOut(); };

   this.zoomLabel = new Label( this );
   this.zoomLabel.text = "Zoom: --";
   this.zoomLabel.setFixedWidth( 90 );

   this.statusLabel = new Label( this );
   this.statusLabel.text = "Click Point 1.";

   this.preview = new MeasurementPreview( this );
   this.preview.setMinSize( 720, 430 );
   this.preview.onImageClick = function( x, y )
   {
      self.handlePreviewClick( x, y );
   };
   this.preview.onPointMoved = function( index, p, finalMove )
   {
      self.handlePointMoved( index, p, finalMove );
   };
   this.preview.onPointSelected = function( index )
   {
      self.handlePointSelected( index );
   };
   this.preview.onHoverPoint = function( p )
   {
      self.handleHoverPoint( p );
   };
   this.preview.onZoomChanged = function( zoom )
   {
      self.zoomLabel.text = "Zoom: " + formatNumber( 100*zoom, zoom < 0.1 ? 2 : 1 ) + "%";
   };
   this.preview.onNudgePoint = function( index, dx, dy )
   {
      self.nudgePoint( index, dx, dy );
   };

   function makeEdit( parent )
   {
      var e = new Edit( parent );
      e.setFixedWidth( 105 );
      return e;
   }

   this.x1Label = new Label( this );
   this.x1Label.text = "X1:";
   this.x1Edit = makeEdit( this );

   this.y1Label = new Label( this );
   this.y1Label.text = "Y1:";
   this.y1Edit = makeEdit( this );

   this.x2Label = new Label( this );
   this.x2Label.text = "X2:";
   this.x2Edit = makeEdit( this );

   this.y2Label = new Label( this );
   this.y2Label.text = "Y2:";
   this.y2Edit = makeEdit( this );

   this.measureButton = new PushButton( this );
   this.measureButton.text = "Measure / apply coordinates";
   this.measureButton.defaultButton = true;
   this.measureButton.onClick = function()
   {
      self.measureFromEdits();
   };

   this.clearButton = new PushButton( this );
   this.clearButton.text = "Clear points";
   this.clearButton.onClick = function()
   {
      self.clearPoints();
   };

   this.resultBox = new TextBox( this );
   this.resultBox.readOnly = true;
   this.resultBox.minHeight = 235;

   this.closeButton = new PushButton( this );
   this.closeButton.text = "Close";
   this.closeButton.onClick = function() { self.ok(); };

   var imageSizer = new HorizontalSizer;
   imageSizer.spacing = 6;
   imageSizer.add( this.imageLabel, 100 );
   imageSizer.add( this.activeButton );
   imageSizer.add( this.openButton );

   var toolbarSizer = new HorizontalSizer;
   toolbarSizer.spacing = 6;
   toolbarSizer.add( this.fitButton );
   toolbarSizer.add( this.zoom11Button );
   toolbarSizer.add( this.zoomInButton );
   toolbarSizer.add( this.zoomOutButton );
   toolbarSizer.addSpacing( 12 );
   toolbarSizer.add( this.autoStretchCheck );
   toolbarSizer.addSpacing( 12 );
   toolbarSizer.add( this.centroidCheck );
   toolbarSizer.add( this.centroidRadiusLabel );
   toolbarSizer.add( this.centroidRadiusSpin );
   toolbarSizer.addSpacing( 12 );
   toolbarSizer.add( this.zoomLabel );
   toolbarSizer.addStretch();
   toolbarSizer.add( this.statusLabel );

   var coordinateSizer = new HorizontalSizer;
   coordinateSizer.spacing = 6;
   coordinateSizer.add( this.x1Label );
   coordinateSizer.add( this.x1Edit );
   coordinateSizer.add( this.y1Label );
   coordinateSizer.add( this.y1Edit );
   coordinateSizer.addSpacing( 12 );
   coordinateSizer.add( this.x2Label );
   coordinateSizer.add( this.x2Edit );
   coordinateSizer.add( this.y2Label );
   coordinateSizer.add( this.y2Edit );
   coordinateSizer.addSpacing( 12 );
   coordinateSizer.add( this.measureButton );
   coordinateSizer.add( this.clearButton );
   coordinateSizer.addStretch();

   var buttonSizer = new HorizontalSizer;
   buttonSizer.addStretch();
   buttonSizer.add( this.closeButton );

   this.sizer = new VerticalSizer;
   this.sizer.margin = 8;
   this.sizer.spacing = 8;
   this.sizer.add( this.titleLabel );
   this.sizer.add( imageSizer );
   this.sizer.add( toolbarSizer );
   this.sizer.add( this.preview, 100 );
   this.sizer.add( coordinateSizer );
   this.sizer.add( this.resultBox );
   this.sizer.add( buttonSizer );

   this.windowTitle = SCRIPT_TITLE + " " + SCRIPT_VERSION;
   this.adjustToContents();

   this.onShow = function()
   {
      self.preview.fitToWindow();
   };

   if ( this.imgWin !== null && !this.imgWin.isNull )
      this.rebuildPreview();
}

PointDistanceDialog.prototype = new Dialog;

PointDistanceDialog.prototype.setImage = function( imgWin )
{
   this.imgWin = imgWin;
   this.imageLabel.text = imageInfoText( this.imgWin );
   this.clearPoints();
   this.rebuildPreview();
};

PointDistanceDialog.prototype.rebuildPreview = function()
{
   if ( this.imgWin === null || this.imgWin.isNull )
      return;

   try
   {
      this.statusLabel.text = "Building preview...";
      processEvents();
      var bitmapResult = createPreviewBitmap( this.imgWin, this.autoStretchCheck.checked );
      this.preview.setImageData( this.imgWin, bitmapResult );
      this.preview.setPoints( this.point1, this.point2 );
      this.preview.setSelectedPoint( this.selectedPoint );
      this.preview.fitToWindow();
      this.statusLabel.text = this.nextPoint === 1 ? "Click Point 1." : "Click Point 2.";
   }
   catch ( e )
   {
      this.statusLabel.text = "Preview failed.";
      new MessageBox( "Could not build the preview:\n" + e.toString(), SCRIPT_TITLE,
                      StdIcon_Error, StdButton_Ok ).execute();
   }
};

PointDistanceDialog.prototype.clearPoints = function()
{
   this.point1 = null;
   this.point2 = null;
   this.nextPoint = 1;
   this.selectedPoint = 0;
   this.x1Edit.text = "";
   this.y1Edit.text = "";
   this.x2Edit.text = "";
   this.y2Edit.text = "";
   this.resultBox.text = "";
   this.statusLabel.text = "Click Point 1.";
   this.preview.setPoints( null, null );
   this.preview.setSelectedPoint( 0 );
};

PointDistanceDialog.prototype.snapPoint = function( p )
{
   if ( !this.centroidCheck.checked || this.imgWin === null || this.imgWin.isNull )
      return { point: p, message: "" };

   var result = findStarCentroid( this.imgWin, p.x, p.y, this.centroidRadiusSpin.value );
   if ( result.snapped )
      return {
         point: { x: result.x, y: result.y },
         message: "Snapped to star centroid (shift " + formatNumber( result.shift, 2 ) + " px)."
      };

   return { point: p, message: "No reliable stellar centroid found; the clicked position was used." };
};

PointDistanceDialog.prototype.updatePointEdits = function( index, p )
{
   if ( index === 1 )
   {
      this.x1Edit.text = formatNumber( p.x, 3 );
      this.y1Edit.text = formatNumber( p.y, 3 );
   }
   else
   {
      this.x2Edit.text = formatNumber( p.x, 3 );
      this.y2Edit.text = formatNumber( p.y, 3 );
   }
};

PointDistanceDialog.prototype.handlePreviewClick = function( x, y )
{
   if ( this.imgWin === null || this.imgWin.isNull )
      return;

   var image = this.imgWin.mainView.image;
   var rawPoint = { x: x, y: y };

   if ( !pointInImage( image, rawPoint ) )
   {
      this.statusLabel.text = "Click inside the image.";
      return;
   }

   var snap = this.snapPoint( rawPoint );
   var p = snap.point;

   if ( this.nextPoint === 1 )
   {
      this.point1 = p;
      this.point2 = null;
      this.preview.hoverPoint = null;
      this.updatePointEdits( 1, p );
      this.x2Edit.text = "";
      this.y2Edit.text = "";
      this.resultBox.text = "";
      this.nextPoint = 2;
      this.selectedPoint = 1;
      this.statusLabel.text = (snap.message.length > 0 ? snap.message + "  " : "") +
                              "Move the pointer and click Point 2.";
   }
   else
   {
      this.point2 = p;
      this.updatePointEdits( 2, p );
      this.nextPoint = 1;
      this.selectedPoint = 2;
      this.statusLabel.text = (snap.message.length > 0 ? snap.message + "  " : "") +
                              "Measured. Drag P1/P2 or use arrow keys to refine.";
      this.measureCurrentPoints( true );
   }

   this.preview.setPoints( this.point1, this.point2 );
   this.preview.setSelectedPoint( this.selectedPoint );
};

PointDistanceDialog.prototype.handlePointSelected = function( index )
{
   this.selectedPoint = index;
   if ( index === 1 || index === 2 )
      this.statusLabel.text = "P" + index + " selected. Drag it, or use arrows (Shift+arrow = 0.1 px).";
};

PointDistanceDialog.prototype.handlePointMoved = function( index, p, finalMove )
{
   if ( this.imgWin === null || this.imgWin.isNull || p === null )
      return;

   var finalPoint = p;
   var message = "";
   if ( finalMove )
   {
      var snap = this.snapPoint( p );
      finalPoint = snap.point;
      message = snap.message;
   }

   if ( index === 1 )
      this.point1 = finalPoint;
   else
      this.point2 = finalPoint;

   this.selectedPoint = index;
   this.updatePointEdits( index, finalPoint );
   this.preview.setPoints( this.point1, this.point2 );
   this.preview.selectedPoint = index;

   if ( this.point1 !== null && this.point2 !== null )
      this.measureCurrentPoints( finalMove );

   if ( finalMove )
      this.statusLabel.text = (message.length > 0 ? message + "  " : "") +
                              "P" + index + " selected; measurement updated.";
   else
      this.statusLabel.text = "Moving P" + index + "...";
};

PointDistanceDialog.prototype.nudgePoint = function( index, dx, dy )
{
   if ( this.imgWin === null || this.imgWin.isNull )
      return;

   var p = index === 1 ? this.point1 : this.point2;
   if ( p === null )
      return;

   var image = this.imgWin.mainView.image;
   var moved = {
      x: Math.max( 0, Math.min( image.width - 1, p.x + dx ) ),
      y: Math.max( 0, Math.min( image.height - 1, p.y + dy ) )
   };

   if ( index === 1 )
      this.point1 = moved;
   else
      this.point2 = moved;

   this.selectedPoint = index;
   this.updatePointEdits( index, moved );
   this.preview.setPoints( this.point1, this.point2 );
   this.preview.selectedPoint = index;

   if ( this.point1 !== null && this.point2 !== null )
      this.measureCurrentPoints( false );

   this.statusLabel.text = "P" + index + " moved to (" +
                           formatNumber( moved.x, 3 ) + ", " +
                           formatNumber( moved.y, 3 ) + ") px.";
};

PointDistanceDialog.prototype.handleHoverPoint = function( p )
{
   if ( p === null || this.point1 === null || this.point2 !== null || this.nextPoint !== 2 )
      return;

   var dx = p.x - this.point1.x;
   var dy = p.y - this.point1.y;
   var distancePx = Math.sqrt( dx*dx + dy*dy );
   var text = "Live: " + formatNumber( distancePx, 2 ) + " px";

   var c1 = imageToCelestialSafe( this.imgWin, this.point1.x, this.point1.y );
   var c2 = imageToCelestialSafe( this.imgWin, p.x, p.y );
   if ( c1 !== null && c2 !== null )
   {
      var arcsec = 3600*greatCircleDistanceDegrees( c1, c2 );
      text += " | " + formatNumber( arcsec, arcsec < 10 ? 3 : 2 ) + " arcsec";
   }
   else
   {
      var scale = getArcsecPerPixelFromMetadata( this.imgWin );
      if ( scale !== null )
         text += " | ~" + formatNumber( distancePx*scale.arcsecPerPixel, 2 ) + " arcsec";
   }

   this.statusLabel.text = text + " | click to set P2";
};

PointDistanceDialog.prototype.measureFromEdits = function()
{
   if ( this.imgWin === null || this.imgWin.isNull )
   {
      new MessageBox( "Open an image or use the active image.", SCRIPT_TITLE,
                      StdIcon_Error, StdButton_Ok ).execute();
      return;
   }

   var p1 = { x: parseFloat( this.x1Edit.text ), y: parseFloat( this.y1Edit.text ) };
   var p2 = { x: parseFloat( this.x2Edit.text ), y: parseFloat( this.y2Edit.text ) };
   var image = this.imgWin.mainView.image;

   if ( !isFinite( p1.x ) || !isFinite( p1.y ) || !isFinite( p2.x ) || !isFinite( p2.y ) )
   {
      new MessageBox( "All four coordinates must be valid numbers.", SCRIPT_TITLE,
                      StdIcon_Error, StdButton_Ok ).execute();
      return;
   }

   if ( !pointInImage( image, p1 ) || !pointInImage( image, p2 ) )
   {
      new MessageBox( "Coordinates must be inside the image:\n" +
                      "X: 0 to " + (image.width - 1) + "\n" +
                      "Y: 0 to " + (image.height - 1),
                      SCRIPT_TITLE, StdIcon_Error, StdButton_Ok ).execute();
      return;
   }

   this.point1 = p1;
   this.point2 = p2;
   this.nextPoint = 1;
   this.selectedPoint = 2;
   this.preview.setPoints( p1, p2 );
   this.preview.setSelectedPoint( 2 );
   this.statusLabel.text = "Measured. Drag P1/P2 or use arrow keys to refine.";
   this.measureCurrentPoints( true );
};

PointDistanceDialog.prototype.measureCurrentPoints = function( writeConsole )
{
   if ( this.point1 === null || this.point2 === null ||
        this.imgWin === null || this.imgWin.isNull )
      return;

   if ( writeConsole === undefined )
      writeConsole = true;

   var p1 = this.point1;
   var p2 = this.point2;
   var dx = p2.x - p1.x;
   var dy = p2.y - p1.y;
   var distancePx = Math.sqrt( dx*dx + dy*dy );
   var imageAngle = distancePx > 0 ? Math.atan2( dy, dx )*180/Math.PI : null;
   if ( imageAngle !== null && imageAngle < 0 ) imageAngle += 360;

   var text = "";
   text += "Image: " + imageName( this.imgWin ) + "\n\n";
   text += "Point 1: (" + formatNumber( p1.x, 3 ) + ", " + formatNumber( p1.y, 3 ) + ") px\n";
   text += "Point 2: (" + formatNumber( p2.x, 3 ) + ", " + formatNumber( p2.y, 3 ) + ") px\n\n";
   text += "Delta X: " + formatNumber( dx, 6 ) + " px\n";
   text += "Delta Y: " + formatNumber( dy, 6 ) + " px\n";
   text += "Pixel distance: " + formatNumber( distancePx, 6 ) + " px\n";
   text += "Image-plane direction: " +
           (imageAngle === null ? "n/a (coincident points)" :
            formatNumber( imageAngle, 6 ) + " deg (clockwise from +X)") + "\n";

   var c1 = imageToCelestialSafe( this.imgWin, p1.x, p1.y );
   var c2 = imageToCelestialSafe( this.imgWin, p2.x, p2.y );

   if ( c1 !== null && c2 !== null )
   {
      var degrees = greatCircleDistanceDegrees( c1, c2 );
      var arcmin = degrees*60;
      var arcsec = degrees*3600;
      var pa = distancePx > 0 ? positionAngleDegrees( c1, c2 ) : null;

      text += "\nAngular calculation: native PixInsight WCS transformation\n";
      text += "Point 1 sky position: RA " + raToHMS( c1.ra ) +
              "  Dec " + decToDMS( c1.dec ) +
              "  (" + formatNumber( c1.ra, 9 ) + ", " + formatNumber( c1.dec, 9 ) + " deg)\n";
      text += "Point 2 sky position: RA " + raToHMS( c2.ra ) +
              "  Dec " + decToDMS( c2.dec ) +
              "  (" + formatNumber( c2.ra, 9 ) + ", " + formatNumber( c2.dec, 9 ) + " deg)\n\n";
      text += "Great-circle angular distance: " + formatNumber( arcsec, 6 ) + " arcsec\n";
      text += "Great-circle angular distance: " + formatNumber( arcmin, 9 ) + " arcmin\n";
      text += "Great-circle angular distance: " + formatNumber( degrees, 12 ) + " deg\n";
      text += "Sky position angle P1 -> P2: " +
              (pa === null ? "n/a (coincident points)" :
               formatNumber( pa, 6 ) + " deg (north through east)") + "\n";

      if ( distancePx > 0 )
         text += "Mean scale along selected segment: " +
                 formatNumber( arcsec/distancePx, 9 ) + " arcsec/px\n";
   }
   else
   {
      var scale = getArcsecPerPixelFromMetadata( this.imgWin );
      if ( scale !== null )
      {
         var approxArcsec = distancePx*scale.arcsecPerPixel;
         text += "\nAngular calculation: approximate (no usable native WCS transformation)\n";
         text += "Scale source: " + scale.source + "\n";
         text += "Angular scale: " + formatNumber( scale.arcsecPerPixel, 9 ) + " arcsec/px\n\n";
         text += "Approximate angular distance: " + formatNumber( approxArcsec, 6 ) + " arcsec\n";
         text += "Approximate angular distance: " + formatNumber( approxArcsec/60, 9 ) + " arcmin\n";
         text += "Approximate angular distance: " + formatNumber( approxArcsec/3600, 12 ) + " deg\n";
      }
      else
      {
         text += "\nAngular distance is unavailable.\n";
         text += "Solve the image astrometrically for an exact WCS-based measurement, " +
                 "or provide pixel-size and focal-length metadata for an approximation.\n";
      }
   }

   this.resultBox.text = text;
   if ( writeConsole )
   {
      Console.writeln( "" );
      Console.writeln( "--- PointDistanceMeasure " + SCRIPT_VERSION + " ---" );
      Console.writeln( text );
   }
};

function main()
{
   Console.show();
   var dialog = new PointDistanceDialog;
   dialog.execute();
}

main();
