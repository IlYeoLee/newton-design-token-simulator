import{a as ne,r as ue,P as He,N as ze}from"./palette-Bj20GXDn.js";import{W as $t,F as P,w as Jt,g as De,b as At,f as ei,a as Dt,G as se,l as ti}from"./fxlut-y4GoJkTC.js";import{ap as ii,V as y,ac as Se,aq as we,Z as ct,ar as dt,Q as M,as as ai,a7 as si,t as Ot,M as k,O as oi,I as We,J as pt,d as q,at as Ge,af as Oe,ah as ke,au as ri,al as ni,n as ce,A as pe,a as de,av as li,m as hi,aw as ui,ax as ci,ay as di,az as pi,aA as fi,aB as mi,aC as gi,aD as vi,aE as _i,S as wi,aF as xi,r as bi,aG as Si,v as ft,P as K,a1 as Ce,am as mt,G as j,a5 as gt,ae as vt,aH as yi,x as _t,aI as Pi,a6 as wt,T as Ti,C as X,R as le,b as Q,D as tt,y as xt,aJ as bt,aK as Mi,N as it,a8 as Fi}from"./three.core-CLCxADIl.js";import{L as w,a as je,b as Ke,n as Ci,Q as St,M as yt,Z as Ri,f as Ei}from"./fx-core-C5xjwlV3.js";const Pt={type:"change"},at={type:"start"},kt={type:"end"},Le=new ai,Tt=new si,Li=Math.cos(70*Ot.DEG2RAD),A=new y,W=2*Math.PI,T={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Qe=1e-6;class Ai extends ii{constructor(e,t=null){super(e,t),this.state=T.NONE,this.target=new y,this.cursor=new y,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:Se.ROTATE,MIDDLE:Se.DOLLY,RIGHT:Se.PAN},this.touches={ONE:we.ROTATE,TWO:we.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._domElementKeyEvents=null,this._lastPosition=new y,this._lastQuaternion=new ct,this._lastTargetPosition=new y,this._quat=new ct().setFromUnitVectors(e.up,new y(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new dt,this._sphericalDelta=new dt,this._scale=1,this._panOffset=new y,this._rotateStart=new M,this._rotateEnd=new M,this._rotateDelta=new M,this._panStart=new M,this._panEnd=new M,this._panDelta=new M,this._dollyStart=new M,this._dollyEnd=new M,this._dollyDelta=new M,this._dollyDirection=new y,this._mouse=new M,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=Oi.bind(this),this._onPointerDown=Di.bind(this),this._onPointerUp=ki.bind(this),this._onContextMenu=Gi.bind(this),this._onMouseWheel=Ui.bind(this),this._onKeyDown=Hi.bind(this),this._onTouchStart=zi.bind(this),this._onTouchMove=Wi.bind(this),this._onMouseDown=Ii.bind(this),this._onMouseMove=Ni.bind(this),this._interceptControlDown=Bi.bind(this),this._interceptControlUp=ji.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(Pt),this.update(),this.state=T.NONE}update(e=null){const t=this.object.position;A.copy(t).sub(this.target),A.applyQuaternion(this._quat),this._spherical.setFromVector3(A),this.autoRotate&&this.state===T.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let a=this.minAzimuthAngle,o=this.maxAzimuthAngle;isFinite(a)&&isFinite(o)&&(a<-Math.PI?a+=W:a>Math.PI&&(a-=W),o<-Math.PI?o+=W:o>Math.PI&&(o-=W),a<=o?this._spherical.theta=Math.max(a,Math.min(o,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(a+o)/2?Math.max(a,this._spherical.theta):Math.min(o,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let i=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{const s=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),i=s!=this._spherical.radius}if(A.setFromSpherical(this._spherical),A.applyQuaternion(this._quatInverse),t.copy(this.target).add(A),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let s=null;if(this.object.isPerspectiveCamera){const l=A.length();s=this._clampDistance(l*this._scale);const h=l-s;this.object.position.addScaledVector(this._dollyDirection,h),this.object.updateMatrixWorld(),i=!!h}else if(this.object.isOrthographicCamera){const l=new y(this._mouse.x,this._mouse.y,0);l.unproject(this.object);const h=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),i=h!==this.object.zoom;const d=new y(this._mouse.x,this._mouse.y,0);d.unproject(this.object),this.object.position.sub(d).add(l),this.object.updateMatrixWorld(),s=A.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;s!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(s).add(this.object.position):(Le.origin.copy(this.object.position),Le.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(Le.direction))<Li?this.object.lookAt(this.target):(Tt.setFromNormalAndCoplanarPoint(this.object.up,this.target),Le.intersectPlane(Tt,this.target))))}else if(this.object.isOrthographicCamera){const s=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),s!==this.object.zoom&&(this.object.updateProjectionMatrix(),i=!0)}return this._scale=1,this._performCursorZoom=!1,i||this._lastPosition.distanceToSquared(this.object.position)>Qe||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Qe||this._lastTargetPosition.distanceToSquared(this.target)>Qe?(this.dispatchEvent(Pt),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?W/60*this.autoRotateSpeed*e:W/60/60*this.autoRotateSpeed}_getZoomScale(e){const t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){A.setFromMatrixColumn(t,0),A.multiplyScalar(-e),this._panOffset.add(A)}_panUp(e,t){this.screenSpacePanning===!0?A.setFromMatrixColumn(t,1):(A.setFromMatrixColumn(t,0),A.crossVectors(this.object.up,A)),A.multiplyScalar(e),this._panOffset.add(A)}_pan(e,t){const a=this.domElement;if(this.object.isPerspectiveCamera){const o=this.object.position;A.copy(o).sub(this.target);let i=A.length();i*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*i/a.clientHeight,this.object.matrix),this._panUp(2*t*i/a.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/a.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/a.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;const a=this.domElement.getBoundingClientRect(),o=e-a.left,i=t-a.top,s=a.width,l=a.height;this._mouse.x=o/s*2-1,this._mouse.y=-(i/l)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const t=this.domElement;this._rotateLeft(W*this._rotateDelta.x/t.clientHeight),this._rotateUp(W*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(W*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-W*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(W*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-W*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),a=.5*(e.pageX+t.x),o=.5*(e.pageY+t.y);this._rotateStart.set(a,o)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),a=.5*(e.pageX+t.x),o=.5*(e.pageY+t.y);this._panStart.set(a,o)}}_handleTouchStartDolly(e){const t=this._getSecondPointerPosition(e),a=e.pageX-t.x,o=e.pageY-t.y,i=Math.sqrt(a*a+o*o);this._dollyStart.set(0,i)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{const a=this._getSecondPointerPosition(e),o=.5*(e.pageX+a.x),i=.5*(e.pageY+a.y);this._rotateEnd.set(o,i)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const t=this.domElement;this._rotateLeft(W*this._rotateDelta.x/t.clientHeight),this._rotateUp(W*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),a=.5*(e.pageX+t.x),o=.5*(e.pageY+t.y);this._panEnd.set(a,o)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){const t=this._getSecondPointerPosition(e),a=e.pageX-t.x,o=e.pageY-t.y,i=Math.sqrt(a*a+o*o);this._dollyEnd.set(0,i),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);const s=(e.pageX+t.x)*.5,l=(e.pageY+t.y)*.5;this._updateZoomParameters(s,l)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new M,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){const t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){const t=e.deltaMode,a={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:a.deltaY*=16;break;case 2:a.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(a.deltaY*=10),a}}function Di(r){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(r.pointerId),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(r)&&(this._addPointer(r),r.pointerType==="touch"?this._onTouchStart(r):this._onMouseDown(r)))}function Oi(r){this.enabled!==!1&&(r.pointerType==="touch"?this._onTouchMove(r):this._onMouseMove(r))}function ki(r){switch(this._removePointer(r),this._pointers.length){case 0:this.domElement.releasePointerCapture(r.pointerId),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(kt),this.state=T.NONE;break;case 1:const e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function Ii(r){let e;switch(r.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case Se.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(r),this.state=T.DOLLY;break;case Se.ROTATE:if(r.ctrlKey||r.metaKey||r.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(r),this.state=T.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(r),this.state=T.ROTATE}break;case Se.PAN:if(r.ctrlKey||r.metaKey||r.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(r),this.state=T.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(r),this.state=T.PAN}break;default:this.state=T.NONE}this.state!==T.NONE&&this.dispatchEvent(at)}function Ni(r){switch(this.state){case T.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(r);break;case T.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(r);break;case T.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(r);break}}function Ui(r){this.enabled===!1||this.enableZoom===!1||this.state!==T.NONE||(r.preventDefault(),this.dispatchEvent(at),this._handleMouseWheel(this._customWheelEvent(r)),this.dispatchEvent(kt))}function Hi(r){this.enabled!==!1&&this._handleKeyDown(r)}function zi(r){switch(this._trackPointer(r),this._pointers.length){case 1:switch(this.touches.ONE){case we.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(r),this.state=T.TOUCH_ROTATE;break;case we.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(r),this.state=T.TOUCH_PAN;break;default:this.state=T.NONE}break;case 2:switch(this.touches.TWO){case we.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(r),this.state=T.TOUCH_DOLLY_PAN;break;case we.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(r),this.state=T.TOUCH_DOLLY_ROTATE;break;default:this.state=T.NONE}break;default:this.state=T.NONE}this.state!==T.NONE&&this.dispatchEvent(at)}function Wi(r){switch(this._trackPointer(r),this.state){case T.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(r),this.update();break;case T.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(r),this.update();break;case T.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(r),this.update();break;case T.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(r),this.update();break;default:this.state=T.NONE}}function Gi(r){this.enabled!==!1&&r.preventDefault()}function Bi(r){r.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function ji(r){r.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}const Ie={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform float opacity;

		uniform sampler2D tDiffuse;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );
			gl_FragColor = opacity * texel;


		}`};class Pe{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}const Ki=new oi(-1,1,1,-1,0,1);class Xi extends We{constructor(){super(),this.setAttribute("position",new pt([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new pt([0,2,0,0,2,0],2))}}const Vi=new Xi;class st{constructor(e){this._mesh=new k(Vi,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,Ki)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class Ne extends Pe{constructor(e,t="tDiffuse"){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof q?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=Ge.clone(e.uniforms),this.material=new q({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new st(this.material)}render(e,t,a){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=a.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class Mt extends Pe{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,a){const o=e.getContext(),i=e.state;i.buffers.color.setMask(!1),i.buffers.depth.setMask(!1),i.buffers.color.setLocked(!0),i.buffers.depth.setLocked(!0);let s,l;this.inverse?(s=0,l=1):(s=1,l=0),i.buffers.stencil.setTest(!0),i.buffers.stencil.setOp(o.REPLACE,o.REPLACE,o.REPLACE),i.buffers.stencil.setFunc(o.ALWAYS,s,4294967295),i.buffers.stencil.setClear(l),i.buffers.stencil.setLocked(!0),e.setRenderTarget(a),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),i.buffers.color.setLocked(!1),i.buffers.depth.setLocked(!1),i.buffers.color.setMask(!0),i.buffers.depth.setMask(!0),i.buffers.stencil.setLocked(!1),i.buffers.stencil.setFunc(o.EQUAL,1,4294967295),i.buffers.stencil.setOp(o.KEEP,o.KEEP,o.KEEP),i.buffers.stencil.setLocked(!0)}}class Yi extends Pe{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class Ft{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){const a=e.getSize(new M);this._width=a.width,this._height=a.height,t=new Oe(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:ke}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Ne(Ie),this.copyPass.material.blending=ri,this.clock=new ni}swapBuffers(){const e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){const t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){e===void 0&&(e=this.clock.getDelta());const t=this.renderer.getRenderTarget();let a=!1;for(let o=0,i=this.passes.length;o<i;o++){const s=this.passes[o];if(s.enabled!==!1){if(s.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(o),s.render(this.renderer,this.writeBuffer,this.readBuffer,e,a),s.needsSwap){if(a){const l=this.renderer.getContext(),h=this.renderer.state.buffers.stencil;h.setFunc(l.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),h.setFunc(l.EQUAL,1,4294967295)}this.swapBuffers()}Mt!==void 0&&(s instanceof Mt?a=!0:s instanceof Yi&&(a=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){const t=this.renderer.getSize(new M);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;const a=this._width*this._pixelRatio,o=this._height*this._pixelRatio;this.renderTarget1.setSize(a,o),this.renderTarget2.setSize(a,o);for(let i=0;i<this.passes.length;i++)this.passes[i].setSize(a,o)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class Zi extends Pe{constructor(e,t,a=null,o=null,i=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=a,this.clearColor=o,this.clearAlpha=i,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new ce}render(e,t,a){const o=e.autoClear;e.autoClear=!1;let i,s;this.overrideMaterial!==null&&(s=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(i=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:a),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(i),this.overrideMaterial!==null&&(this.scene.overrideMaterial=s),e.autoClear=o}}const Qi={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new ce(0)},defaultOpacity:{value:0}},vertexShader:`

		varying vec2 vUv;

		void main() {

			vUv = uv;

			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		uniform sampler2D tDiffuse;
		uniform vec3 defaultColor;
		uniform float defaultOpacity;
		uniform float luminosityThreshold;
		uniform float smoothWidth;

		varying vec2 vUv;

		void main() {

			vec4 texel = texture2D( tDiffuse, vUv );

			float v = luminance( texel.xyz );

			vec4 outputColor = vec4( defaultColor.rgb, defaultOpacity );

			float alpha = smoothstep( luminosityThreshold, luminosityThreshold + smoothWidth, v );

			gl_FragColor = mix( outputColor, texel, alpha );

		}`};class ye extends Pe{constructor(e,t=1,a,o){super(),this.strength=t,this.radius=a,this.threshold=o,this.resolution=e!==void 0?new M(e.x,e.y):new M(256,256),this.clearColor=new ce(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let i=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);this.renderTargetBright=new Oe(i,s,{type:ke}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let n=0;n<this.nMips;n++){const _=new Oe(i,s,{type:ke});_.texture.name="UnrealBloomPass.h"+n,_.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(_);const c=new Oe(i,s,{type:ke});c.texture.name="UnrealBloomPass.v"+n,c.texture.generateMipmaps=!1,this.renderTargetsVertical.push(c),i=Math.round(i/2),s=Math.round(s/2)}const l=Qi;this.highPassUniforms=Ge.clone(l.uniforms),this.highPassUniforms.luminosityThreshold.value=o,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new q({uniforms:this.highPassUniforms,vertexShader:l.vertexShader,fragmentShader:l.fragmentShader}),this.separableBlurMaterials=[];const h=[3,5,7,9,11];i=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);for(let n=0;n<this.nMips;n++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(h[n])),this.separableBlurMaterials[n].uniforms.invSize.value=new M(1/i,1/s),i=Math.round(i/2),s=Math.round(s/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;const d=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=d,this.bloomTintColors=[new y(1,1,1),new y(1,1,1),new y(1,1,1),new y(1,1,1),new y(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=Ge.clone(Ie.uniforms),this.blendMaterial=new q({uniforms:this.copyUniforms,vertexShader:Ie.vertexShader,fragmentShader:Ie.fragmentShader,blending:pe,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new ce,this._oldClearAlpha=1,this._basic=new de,this._fsQuad=new st(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let a=Math.round(e/2),o=Math.round(t/2);this.renderTargetBright.setSize(a,o);for(let i=0;i<this.nMips;i++)this.renderTargetsHorizontal[i].setSize(a,o),this.renderTargetsVertical[i].setSize(a,o),this.separableBlurMaterials[i].uniforms.invSize.value=new M(1/a,1/o),a=Math.round(a/2),o=Math.round(o/2)}render(e,t,a,o,i){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();const s=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),i&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=a.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=a.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let l=this.renderTargetBright;for(let h=0;h<this.nMips;h++)this._fsQuad.material=this.separableBlurMaterials[h],this.separableBlurMaterials[h].uniforms.colorTexture.value=l.texture,this.separableBlurMaterials[h].uniforms.direction.value=ye.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[h]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[h].uniforms.colorTexture.value=this.renderTargetsHorizontal[h].texture,this.separableBlurMaterials[h].uniforms.direction.value=ye.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[h]),e.clear(),this._fsQuad.render(e),l=this.renderTargetsVertical[h];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,i&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(a),this._fsQuad.render(e)),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=s}_getSeparableBlurMaterial(e){const t=[];for(let a=0;a<e;a++)t.push(.39894*Math.exp(-.5*a*a/(e*e))/e);return new q({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new M(.5,.5)},direction:{value:new M(.5,.5)},gaussianCoefficients:{value:t}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`#include <common>
				varying vec2 vUv;
				uniform sampler2D colorTexture;
				uniform vec2 invSize;
				uniform vec2 direction;
				uniform float gaussianCoefficients[KERNEL_RADIUS];

				void main() {
					float weightSum = gaussianCoefficients[0];
					vec3 diffuseSum = texture2D( colorTexture, vUv ).rgb * weightSum;
					for( int i = 1; i < KERNEL_RADIUS; i ++ ) {
						float x = float(i);
						float w = gaussianCoefficients[i];
						vec2 uvOffset = direction * invSize * x;
						vec3 sample1 = texture2D( colorTexture, vUv + uvOffset ).rgb;
						vec3 sample2 = texture2D( colorTexture, vUv - uvOffset ).rgb;
						diffuseSum += (sample1 + sample2) * w;
						weightSum += 2.0 * w;
					}
					gl_FragColor = vec4(diffuseSum/weightSum, 1.0);
				}`})}_getCompositeMaterial(e){return new q({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
				void main() {
					vUv = uv;
					gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );
				}`,fragmentShader:`varying vec2 vUv;
				uniform sampler2D blurTexture1;
				uniform sampler2D blurTexture2;
				uniform sampler2D blurTexture3;
				uniform sampler2D blurTexture4;
				uniform sampler2D blurTexture5;
				uniform float bloomStrength;
				uniform float bloomRadius;
				uniform float bloomFactors[NUM_MIPS];
				uniform vec3 bloomTintColors[NUM_MIPS];

				float lerpBloomFactor(const in float factor) {
					float mirrorFactor = 1.2 - factor;
					return mix(factor, mirrorFactor, bloomRadius);
				}

				void main() {
					gl_FragColor = bloomStrength * ( lerpBloomFactor(bloomFactors[0]) * vec4(bloomTintColors[0], 1.0) * texture2D(blurTexture1, vUv) +
						lerpBloomFactor(bloomFactors[1]) * vec4(bloomTintColors[1], 1.0) * texture2D(blurTexture2, vUv) +
						lerpBloomFactor(bloomFactors[2]) * vec4(bloomTintColors[2], 1.0) * texture2D(blurTexture3, vUv) +
						lerpBloomFactor(bloomFactors[3]) * vec4(bloomTintColors[3], 1.0) * texture2D(blurTexture4, vUv) +
						lerpBloomFactor(bloomFactors[4]) * vec4(bloomTintColors[4], 1.0) * texture2D(blurTexture5, vUv) );
				}`})}}ye.BlurDirectionX=new M(1,0);ye.BlurDirectionY=new M(0,1);const Ae={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
		precision highp float;

		uniform mat4 modelViewMatrix;
		uniform mat4 projectionMatrix;

		attribute vec3 position;
		attribute vec2 uv;

		varying vec2 vUv;

		void main() {

			vUv = uv;
			gl_Position = projectionMatrix * modelViewMatrix * vec4( position, 1.0 );

		}`,fragmentShader:`

		precision highp float;

		uniform sampler2D tDiffuse;

		#include <tonemapping_pars_fragment>
		#include <colorspace_pars_fragment>

		varying vec2 vUv;

		void main() {

			gl_FragColor = texture2D( tDiffuse, vUv );

			// tone mapping

			#ifdef LINEAR_TONE_MAPPING

				gl_FragColor.rgb = LinearToneMapping( gl_FragColor.rgb );

			#elif defined( REINHARD_TONE_MAPPING )

				gl_FragColor.rgb = ReinhardToneMapping( gl_FragColor.rgb );

			#elif defined( CINEON_TONE_MAPPING )

				gl_FragColor.rgb = CineonToneMapping( gl_FragColor.rgb );

			#elif defined( ACES_FILMIC_TONE_MAPPING )

				gl_FragColor.rgb = ACESFilmicToneMapping( gl_FragColor.rgb );

			#elif defined( AGX_TONE_MAPPING )

				gl_FragColor.rgb = AgXToneMapping( gl_FragColor.rgb );

			#elif defined( NEUTRAL_TONE_MAPPING )

				gl_FragColor.rgb = NeutralToneMapping( gl_FragColor.rgb );

			#elif defined( CUSTOM_TONE_MAPPING )

				gl_FragColor.rgb = CustomToneMapping( gl_FragColor.rgb );

			#endif

			// color space

			#ifdef SRGB_TRANSFER

				gl_FragColor = sRGBTransferOETF( gl_FragColor );

			#endif

		}`};class qi extends Pe{constructor(){super(),this.uniforms=Ge.clone(Ae.uniforms),this.material=new li({name:Ae.name,uniforms:this.uniforms,vertexShader:Ae.vertexShader,fragmentShader:Ae.fragmentShader}),this._fsQuad=new st(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,a){this.uniforms.tDiffuse.value=a.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},hi.getTransfer(this._outputColorSpace)===ui&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===ci?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===di?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===pi?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===fi?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===mi?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===gi?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===vi&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}const O={bloomThreshold:.55,bloomStrength:.55,bloomRadius:.6,grain:0,vignette:.12,exposure:1,alphaOut:!1,alphaFloor:0,alphaGamma:1,inkAlpha:!1},$i={uniforms:{tDiffuse:{value:null},uGrain:{value:O.grain},uVignette:{value:O.vignette},uExposure:{value:O.exposure},uTime:{value:0},uAlphaOut:{value:0},uAlphaFloor:{value:0},uAlphaGamma:{value:1}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform float uGrain, uVignette, uExposure, uTime, uAlphaOut, uAlphaFloor, uAlphaGamma;
    varying vec2 vUv;
    float hash(vec2 p){ return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
    void main(){
      vec4 c = texture2D(tDiffuse, vUv);
      c.rgb *= uExposure;
      float d = distance(vUv, vec2(0.5));
      c.rgb *= 1.0 - smoothstep(0.45, 0.95, d) * uVignette;
      c.rgb += (hash(vUv * 913.7 + fract(uTime) * 7.0) - 0.5) * uGrain;   // 필름 그레인
      c.rgb += (hash(vUv * 517.3) - 0.5) * (2.0 / 255.0);                  // 디더 (밴딩 제거)
      // ★ 투사는 가산광이다 — '빛이 있는 만큼'이 곧 불투명도다.
      //   블룸 패스가 알파를 1 로 채워 투명 내보내기가 안 되던 것의 해법이기도 하다:
      //   알파를 따로 보존하려 애쓰는 대신 휘도에서 뽑으면 물리적으로도 맞고 매트도 깨끗하다.
      if (uAlphaOut > 0.5) {
        float L = max(c.r, max(c.g, c.b));
        // 문턱 아래는 잘라 내고 남은 구간을 다시 편다 — 문턱을 넘는 빛의 밝기는 그대로 보존된다.
        float g = clamp((L - uAlphaFloor) / max(1.0 - uAlphaFloor, 1e-3), 0.0, 1.0);
        // 감마로 어두운 쪽을 들어 올린다. pow 밑은 clamp 로 이미 0 이상 — 음수 밑 NaN 함정 없음.
        g = pow(g, max(uAlphaGamma, 1e-3));
        gl_FragColor = vec4(c.rgb, clamp(g * 1.8, 0.0, 1.0));
      } else gl_FragColor = c;
    }`},xe=-1.8;function _a(r){const e=new URLSearchParams(location.search).get("alpha")==="1",t=new $t({antialias:!0,alpha:e,premultipliedAlpha:!1});e&&t.setClearColor(0,0),t.setPixelRatio(Math.min(window.devicePixelRatio,2));const a=t.capabilities.getMaxAnisotropy();t.setSize(r.clientWidth,r.clientHeight),t.shadowMap.enabled=!0,t.shadowMap.type=_i,t.localClippingEnabled=!0,r.appendChild(t.domElement);const o=new wi;o.background=new ce(790034),o.fog=new xi(790034,9,20);const i=new bi(50,r.clientWidth/r.clientHeight,.05,60),s=new Ai(i,t.domElement);s.enableDamping=!0,s.dampingFactor=.08,s.maxPolarAngle=Math.PI*.495,s.minDistance=1.2,s.maxDistance=14,o.add(new Si(3752527,1119258,1.1));const l=new ft(16777215,1.5);l.position.set(3,6,4),l.castShadow=!0,l.shadow.mapSize.set(2048,2048),l.shadow.camera.left=-5,l.shadow.camera.right=5,l.shadow.camera.top=5,l.shadow.camera.bottom=-5,o.add(l);const h=new ft(5227511,.35);h.position.set(-4,3,-3),o.add(h);const d=new k(new K(120,120),new Ce({color:1514016,roughness:.92,metalness:.05}));d.rotation.x=-Math.PI/2,d.receiveShadow=!0,o.add(d);const n=new mt(120,240,2304051,1777706);n.position.y=.002,o.add(n);const _=new j,c=new k(new K(5,3.2),new Ce({color:1843240,roughness:.95}));c.position.set(0,1.6,xe),c.receiveShadow=!0,_.add(c);const x=new mt(5,10,2765120,2304567);x.rotation.x=Math.PI/2,x.position.set(0,1.6,xe+.005),_.add(x),o.add(_);const D=(()=>{const u=new j,v=3.05,p=-7,f=.225,g=p-.15,b=new Ce({color:2830134,roughness:.6,metalness:.3}),S=new k(new gt(1.8,1.05,.03),new Ce({color:15594231,roughness:.25,metalness:.05,transparent:!0,opacity:.55}));S.position.set(0,v+.375,g-.015),S.castShadow=!0,u.add(S);const H=new vt(new yi(new gt(.59,.45,.001)),new _t({color:15229482}));H.position.set(0,v+.19,g+.02),u.add(H);const I=new k(new Pi(f,.014,10,28),new Ce({color:15229482,roughness:.4,metalness:.5}));I.rotation.x=Math.PI/2,I.position.set(0,v,p),I.castShadow=!0,u.add(I);const L=12,z=.4,G=.09,B=(N,Qt)=>Array.from({length:L},(pa,qt)=>{const ut=qt/L*Math.PI*2;return new y(Math.cos(ut)*N,Qt,p+Math.sin(ut)*N)}),ge=B(f,v),ve=B((f+G)/2,v-z*.5),re=B(G,v-z),Ve=[];for(let N=0;N<L;N++)Ve.push(ge[N],ve[N],ve[N],re[N]);for(let N=0;N<L;N++)Ve.push(ve[N],ve[(N+1)%L],re[N],re[(N+1)%L]);const Zt=new vt(new We().setFromPoints(Ve),new _t({color:16119280,transparent:!0,opacity:.75}));u.add(Zt);const Ye=new k(new wt(.05,.06,S.position.y+.4,12),b);Ye.position.set(0,(S.position.y+.4)/2,g-.35),Ye.castShadow=!0,u.add(Ye);const Ze=new k(new wt(.035,.035,.36,10),b);return Ze.rotation.x=Math.PI/2,Ze.position.set(0,S.position.y,g-.18),u.add(Ze),u.visible=!1,u.name="hoop",o.add(u),u})();let E=null;function C(){D.visible=E==="basketball"&&["court","court_tile","court_gray","court_black"].includes(Me)}const R=new Ti,F={},ee="./";function Te(u,v,p){return new Promise(f=>{R.load(`${ee}tex/${u}`,g=>{g.wrapS=g.wrapT=le,g.repeat.set(v,p),g.anisotropy=a,g.colorSpace=Q,f(g)})})}async function te(u){if(F[u])return F[u];if(u==="grass")F.grass=await Te("grass.jpg",60,60);else if(u==="paving")F.paving=await Te("paving.jpg",50,50);else if(u==="plaster")F.plaster=await Te("plaster.jpg",2.5,1.6);else if(u==="court_tile"){const v=document.createElement("canvas");v.width=v.height=512;const p=v.getContext("2d"),f=128;p.fillStyle="#DCDEDF",p.fillRect(0,0,512,512);for(let b=0;b<4;b++)for(let S=0;S<4;S++){const H=S*f,I=b*f,L=(S*7+b*13)%5/5;p.fillStyle=`rgb(${214+L*10|0},${217+L*10|0},${219+L*10|0})`,p.fillRect(H,I,f,f),p.strokeStyle="rgba(150,156,161,0.5)",p.lineWidth=2,p.strokeRect(H+1,I+1,f-2,f-2),p.strokeStyle="rgba(156,163,169,0.62)",p.lineWidth=1.1;const z=f/4;for(let G=0;G<4;G++)for(let B=0;B<4;B++){const ge=H+G*z,ve=I+B*z;for(let re=0;re<2;re++)p.beginPath(),p.roundRect(ge+4+re*13,ve+5,11,z-10,3.5),p.stroke()}}const g=new X(v);g.wrapS=g.wrapT=le,g.repeat.set(120,120),g.anisotropy=a,g.colorSpace=Q,F.court_tile=g}else if(u==="ivorywood"){const v=document.createElement("canvas");v.width=v.height=512;const p=v.getContext("2d"),f=(()=>{let S=11;return()=>(S=S*16807%2147483647)/2147483647})(),g=74;for(let S=0;S*g<512+g;S++){const H=S%2*190;for(let I=-1;I<3;I++){const L=I*380+H,z=S*g,G=.962+f()*.072;p.fillStyle=`rgb(${Math.min(255,236*G)|0}, ${Math.min(255,230*G)|0}, ${Math.min(255,222*G)|0})`,p.fillRect(L,z,380,g),p.strokeStyle="rgba(196,186,170,0.34)",p.lineWidth=1.4,p.strokeRect(L+.7,z+.7,380-1.4,g-1.4),p.strokeStyle="rgba(204,195,180,0.20)",p.lineWidth=1;for(let B=0;B<3;B++){const ge=z+12+f()*(g-24);p.beginPath(),p.moveTo(L+8,ge),p.lineTo(L+372,ge+(f()-.5)*5),p.stroke()}}}const b=new X(v);b.wrapS=b.wrapT=le,b.repeat.set(46,46),b.anisotropy=a,b.colorSpace=Q,F.ivorywood=b}else if(u==="track"){const v=await new Promise(b=>{const S=new Image;S.onload=()=>b(S),S.src=`${ee}tex/asphalt.jpg`}),p=document.createElement("canvas");p.width=p.height=512;const f=p.getContext("2d");f.fillStyle="#B7C6AA",f.fillRect(0,0,512,512),f.globalAlpha=.34,f.globalCompositeOperation="overlay",f.drawImage(v,0,0,512,512),f.globalAlpha=.12,f.globalCompositeOperation="saturation",f.fillStyle="#808080",f.fillRect(0,0,512,512),f.globalAlpha=1,f.globalCompositeOperation="source-over";const g=new X(p);g.wrapS=g.wrapT=le,g.repeat.set(60,60),g.anisotropy=a,g.colorSpace=Q,F.track=g}else if(u==="dirt"){const v=await new Promise(b=>{const S=new Image;S.onload=()=>b(S),S.src=`${ee}tex/asphalt.jpg`}),p=document.createElement("canvas");p.width=p.height=512;const f=p.getContext("2d");f.fillStyle="#C4BBA4",f.fillRect(0,0,512,512),f.globalAlpha=.4,f.globalCompositeOperation="overlay",f.drawImage(v,0,0,512,512),f.globalAlpha=.16,f.globalCompositeOperation="saturation",f.fillStyle="#808080",f.fillRect(0,0,512,512),f.globalAlpha=1,f.globalCompositeOperation="source-over",f.strokeStyle="rgba(120,110,92,0.35)",f.lineWidth=2,f.beginPath(),f.moveTo(0,256),f.lineTo(512,262),f.moveTo(256,0),f.lineTo(250,512),f.stroke();const g=new X(p);g.wrapS=g.wrapT=le,g.repeat.set(24,24),g.anisotropy=a,g.colorSpace=Q,F.dirt=g}else if(u==="indoorwood"){const v=document.createElement("canvas");v.width=v.height=512;const p=v.getContext("2d"),f=(()=>{let b=7;return()=>(b=b*16807%2147483647)/2147483647})();for(let b=0;b<8;b++){const S=b%2*128;for(let H=-1;H<3;H++){const I=H*256+S,L=b*64,z=.82+f()*.3;p.fillStyle=`rgb(${Math.round(168*z)}, ${Math.round(126*z)}, ${Math.round(84*z)})`,p.fillRect(I,L,256,64),p.strokeStyle="rgba(70,48,30,0.55)",p.lineWidth=2,p.strokeRect(I+1,L+1,254,62),p.strokeStyle="rgba(90,62,40,0.25)",p.lineWidth=1;for(let G=0;G<4;G++){const B=L+10+f()*46;p.beginPath(),p.moveTo(I+6,B),p.lineTo(I+250,B+(f()-.5)*6),p.stroke()}}}const g=new X(v);g.wrapS=g.wrapT=le,g.repeat.set(26,26),g.anisotropy=a,g.colorSpace=Q,F.indoorwood=g}else if(u==="wallpaper"){const v=document.createElement("canvas");v.width=v.height=256;const p=v.getContext("2d");p.fillStyle="#F6F5F2",p.fillRect(0,0,256,256);const f=(()=>{let b=13;return()=>(b=b*16807%2147483647)/2147483647})();for(let b=0;b<256;b+=2){const S=.02+f()*.045;p.fillStyle=f()<.5?`rgba(208,205,198,${S})`:`rgba(255,255,255,${S})`,p.fillRect(b,0,1+f()*1.5,256)}for(let b=0;b<90;b++)p.fillStyle=`rgba(196,188,174,${.03+f()*.04})`,p.fillRect(f()*256,f()*256,1,3+f()*9);const g=new X(v);g.wrapS=g.wrapT=le,g.repeat.set(9,5),g.anisotropy=a,g.colorSpace=Q,F.wallpaper=g}return F[u]}let Re=0,Me=null;function ot(){return Me==="indoor"?15723490:!Me||Me==="none"?8291727:12173514}function rt(){if(!U)return;const u=ot();o.background.setHex(u),o.fog.color.setHex(u)}let V=null,Y=null,$=null;function zt(){if($)return $;$=new j;const u=new de({color:16316660,transparent:!0,opacity:.85,depthWrite:!1}),v=[.95,2.85,4.75];for(const p of v)for(const f of[-1,1]){const g=new k(new K(.055,80),u);g.rotation.x=-Math.PI/2,g.position.set(f*p,.002,0),$.add(g)}return $.renderOrder=1,o.add($),$}async function Wt(u){const v=++Re;if(Me=!u||u==="none"?null:u,!u||u==="none"){d.material.map=null,d.material.color.setHex(U?6712438:1514016),c.material.map=null,c.material.color.setHex(U?7765126:1843240),c.material.emissive?.setHex(0),d.material.needsUpdate=!0,c.material.needsUpdate=!0,n.visible=!0,x.visible=!0,V&&(V.visible=!1),Y&&(Y.visible=!1),C(),rt();return}const p=u==="court_gray"||u==="court_black",f=u==="indoor"?"ivorywood":u==="court"?"indoorwood":u,[g,b]=await Promise.all([p?null:te(f),te("plaster")]);if(v===Re){if(!V){const H=new q({uniforms:{uColor:{value:new ce(16448245)},uOpacity:{value:.85},uHalf:{value:.025}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`
          varying vec2 vUv; uniform vec3 uColor; uniform float uOpacity, uHalf;
          const float FAR = 1e3;
          float dRect(vec2 p, vec2 c, vec2 h){          // 사각 외곽선까지의 거리
            vec2 d = abs(p - c) - h;
            return abs(min(max(d.x, d.y), 0.0) + length(max(d, 0.0)));
          }
          float dArc(vec2 p, vec2 c, float r, float zMin){   // 원호 — z 하한으로 반원·부분호를 자른다
            return p.y < zMin ? FAR : abs(length(p - c) - r);
          }
          float dArcMax(vec2 p, vec2 c, float r, float zMax){
            return p.y > zMax ? FAR : abs(length(p - c) - r);
          }
          void main(){
            vec2 p = vec2(vUv.x * 16.0 - 8.0, 8.0 - vUv.y * 16.0);   // (월드 x, 월드 z)
            float d = dRect(p, vec2(0.0, 0.0), vec2(7.5, 7.5));      // 외곽 하프코트 15×15
            d = min(d, dRect(p, vec2(0.0, -4.6), vec2(2.45, 2.9)));  // 페인트존(키)
            d = min(d, dArc(p, vec2(0.0, -1.7), 1.8, -1.7));         // 자유투 반원(전방)
            d = min(d, dArc(p, vec2(0.0, -6.325), 6.75, -5.115));    // 3점 아크(양끝 살짝 잘림)
            d = min(d, dArcMax(p, vec2(0.0, 7.5), 1.8, 7.5));        // 센터서클 근측 절반
            float aa = max(fwidth(d), 1e-5);                          // 화면공간 폭 — 배율 무관 AA
            float a = 1.0 - smoothstep(uHalf - aa, uHalf + aa, d);
            if (a < 0.004) discard;
            gl_FragColor = vec4(uColor, a * uOpacity);
          }`,transparent:!0,depthWrite:!1});V=new k(new K(16,16),H),V.rotation.x=-Math.PI/2,V.position.y=.006,V.renderOrder=1,V.name="courtLines",o.add(V)}if(!Y){const S=new q({uniforms:{uTint:{value:new ce(11975358)},uOut:{value:.5},uKey:{value:.22}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`
          varying vec2 vUv; uniform vec3 uTint; uniform float uOut, uKey;
          float sdBox(vec2 p, vec2 h){ vec2 d = abs(p) - h; return min(max(d.x, d.y), 0.0) + length(max(d, 0.0)); }
          void main(){
            vec2 p = vec2(vUv.x * 60.0 - 30.0, 30.0 - vUv.y * 60.0);   // (월드 x, 월드 z)
            float sdC = sdBox(p, vec2(7.5));                            // 코트 경계
            float outside = smoothstep(-fwidth(sdC), fwidth(sdC), sdC);
            float sdK = sdBox(p - vec2(0.0, -4.6), vec2(2.45, 2.9));    // 페인트존
            float key = 1.0 - smoothstep(-fwidth(sdK), fwidth(sdK), sdK);
            // 대지 가장자리는 서서히 풀어 60m 사각 경계가 드러나지 않게
            float edge = 1.0 - smoothstep(22.0, 29.5, max(abs(p.x), abs(p.y)));
            float a = max(outside * uOut, key * uKey) * edge;
            if (a < 0.004) discard;
            gl_FragColor = vec4(uTint, a);
          }`,transparent:!0,depthWrite:!1});Y=new k(new K(60,60),S),Y.rotation.x=-Math.PI/2,Y.position.y=.005,Y.renderOrder=0,Y.name="courtZones",o.add(Y)}if(Y.visible=u==="court_tile",V.visible=u==="court"||u==="court_tile"||p,u==="track"?zt().visible=!0:$&&($.visible=!1),d.material.map=p?null:g,c.material.map=b,p)d.material.color.setHex(u==="court_black"?2502721:2830912),d.material.roughness=u==="court_black"?.42:.6,d.material.metalness=u==="court_black"?.22:.12,c.material.map=await te("wallpaper"),c.material.color.setHex(16777215),c.material.emissive?.setHex(U?7236195:5722955);else if(u==="court_tile"||u==="track"){const S=u==="court_tile";d.material.roughness=S?.78:.92,d.material.metalness=S?.04:.05,d.material.color.setHex(U?14474975:12567753),c.material.map=await te("wallpaper"),c.material.color.setHex(16777215),c.material.emissive?.setHex(U?7236195:5722955)}else u==="indoor"||u==="court"?(d.material.roughness=.92,d.material.metalness=.05,d.material.color.setHex(u==="indoor"?U?16249577:14209218:U?16183784:14209218),c.material.map=await te("wallpaper"),c.material.color.setHex(16777215),c.material.emissive?.setHex(U?7236195:5722955)):(c.material.emissive?.setHex(0),d.material.roughness=.92,d.material.metalness=.05,d.material.color.setHex(U?14408667:9079434),c.material.color.setHex(U?14869218:10132122));d.material.needsUpdate=!0,c.material.needsUpdate=!0,n.visible=!1,x.visible=!1,C(),rt()}}const nt={running:{pos:[2.9,2.1,2.9],look:[0,.7,-.6]},boxing:{pos:[3.5,1.9,3.9],look:[0,1.1,-.1]},basketball:{pos:[3.4,2.6,2.6],look:[0,.6,-1]}};function Gt(u){const v=nt[u]||nt.running;i.position.set(...v.pos),s.target.set(...v.look),s.update()}function Bt(u,v){_.visible=!!v,E=u,C(),Gt(u)}const fe=o.children.find(u=>u.isHemisphereLight);let U=!1;function jt(u){if(U=!!u,O.day=U,U){const v=ot();o.background.setHex(v),o.fog.color.setHex(v),o.fog.near=14,o.fog.far=40,fe.color.setHex(14476526),fe.groundColor.setHex(8291468),fe.intensity=1.1,l.intensity=1.6,l.color.setHex(16774112),h.intensity=.12,d.material.map||d.material.color.setHex(6712438),c.material.map||c.material.color.setHex(7765126),d.material.map&&d.material.color.setHex(14408667),c.material.map&&c.material.color.setHex(14869218)}else o.background.setHex(790034),o.fog.color.setHex(790034),o.fog.near=9,o.fog.far=20,fe.color.setHex(3752527),fe.groundColor.setHex(1119258),fe.intensity=1.1,l.intensity=1.5,l.color.setHex(16777215),h.intensity=.35,d.material.map||d.material.color.setHex(1514016),c.material.map||c.material.color.setHex(1843240),d.material.map&&d.material.color.setHex(9079434),c.material.map&&c.material.color.setHex(10132122);d.material.needsUpdate=!0,c.material.needsUpdate=!0}const ie=new Ft(t),Xe=new Zi(o,i);ie.addPass(Xe),ie.addPass(new Ne({uniforms:{tDiffuse:{value:null}},vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);if(c.r!=c.r||c.g!=c.g||c.b!=c.b||c.a!=c.a)c=vec4(0.0);gl_FragColor=clamp(c,0.0,60.0);}"}));const Fe=new ye(new M(r.clientWidth/2,r.clientHeight/2),O.bloomStrength,O.bloomRadius,O.bloomThreshold);ie.addPass(Fe),ie.renderToScreen=!1;const me=new Ft(t);me.addPass(Xe);const lt=new Ne({uniforms:{tDiffuse:{value:null},tBloom:{value:ie.renderTarget2.texture},uInkAlpha:{value:0}},vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"uniform sampler2D tDiffuse,tBloom;uniform float uInkAlpha;varying vec2 vUv;void main(){vec4 s=texture2D(tDiffuse,vUv),b=texture2D(tBloom,vUv);gl_FragColor=vec4(s.rgb+b.rgb, mix(s.a+b.a, s.a, uInkAlpha));}"});me.addPass(lt);const ae=new Ne($i);me.addPass(ae),me.addPass(new qi);const Ee=[];function Kt(){Ee.length=0,o.traverse(u=>{u.visible&&u.material?._noBloom&&(u.visible=!1,Ee.push(u))})}function Xt(){for(const u of Ee)u.visible=!0;Ee.length=0}function Vt(u){Fe.threshold=O.bloomThreshold+(O.day?.38:0),Fe.strength=O.bloomStrength,Fe.radius=O.bloomRadius,ae.uniforms.uGrain.value=O.grain,ae.uniforms.uVignette.value=O.vignette,ae.uniforms.uExposure.value=O.exposure,ae.uniforms.uTime.value=u,ae.uniforms.uAlphaOut.value=O.alphaOut?1:0,ae.uniforms.uAlphaFloor.value=O.alphaFloor||0,ae.uniforms.uAlphaGamma.value=O.alphaGamma||1,lt.uniforms.uInkAlpha.value=O.inkAlpha?1:0,Kt(),ie.render(),Xt(),me.render()}function ht(){t.domElement.style.width="0px",t.domElement.style.height="0px";const u=r.clientWidth,v=r.clientHeight;i.aspect=u/v,i.updateProjectionMatrix(),t.setSize(u,v),ie.setSize(u,v),me.setSize(u,v),Fe.setSize(u/2,v/2)}window.addEventListener("resize",ht);function Yt(u){const v=Math.round(u/2)*2;d.position.z=v,n.position.z=v}return{renderer:t,scene:o,camera:i,controls:s,setPackEnvironment:Bt,resize:ht,renderFrame:Vt,composer:ie,setSurfaces:Wt,setDaylight:jt,followFloor:Yt,wall:c,wallGroup:_,hoop:D,setRenderCamera:u=>{Xe.camera=u}}}const It=`
#include <common>
#include <clipping_planes_pars_vertex>
varying vec2 vUv;
varying vec3 vWorldPos;   // 레인 풋프린트 소프트 페이드용 (LANEFX_FRAG 소비, MARKFX_FRAG는 미사용)
void main() {
  vUv = uv;
  vWorldPos = (modelMatrix * vec4(position, 1.0)).xyz;
  vec4 mvPosition = modelViewMatrix * vec4(position, 1.0);
  gl_Position = projectionMatrix * mvPosition;
  #include <clipping_planes_vertex>
}`,Ji=`
uniform float uHT, uHTPitch, uHTGain, uHTSoft, uHTWave, uHTGlow, uHTInner;
uniform sampler2D uNumTex; uniform float uNumOn, uNumScale; uniform vec2 uNumOff;   // 하프톤 스킨 — 후보랩 확정본
#include <common>
#include <clipping_planes_pars_fragment>
`+At+`
uniform float uW, uHalo, uNoise;
`+Ci+`
uniform float uPhase, uProg, uFade, uStrong, uTime, uGain, uDay, uOut, uToe;
uniform float uStatePrev, uPrevProg, uXfade;   // 상태 크로스페이드(0.28s) — 이전 상태·진행·혼합량
uniform vec3 uFPOrigin, uFPFwd, uFPRight;
uniform float uFPNear, uFPFar, uFPHalfN, uFPHalfF, uFPFadeM;
uniform vec3 uUIOrigin, uUIFwd, uUIRight;
uniform float uUIHalfL, uUIHalfW, uUIFeather, uUIAmt;
varying vec2 vUv;
varying vec3 vWorldPos;
// 투사면 경계 소프트 페이드(레인과 동일) — 클리핑 하드컷이 사각형으로 드러나기 전에 알파를 죽임.
float footprintFade(vec3 wp) {
  vec2 rel = wp.xz - uFPOrigin.xz;
  float d = rel.x * uFPFwd.x + rel.y * uFPFwd.z;
  float h = rel.x * uFPRight.x + rel.y * uFPRight.z;
  float half_ = mix(uFPHalfN, uFPHalfF, clamp((d - uFPNear) / max(0.01, uFPFar - uFPNear), 0.0, 1.0));
  float fadeLen = smoothstep(uFPNear, uFPNear + uFPFadeM, d) * smoothstep(uFPFar, uFPFar - uFPFadeM, d);
  float fadeW = smoothstep(half_, half_ - uFPFadeM, abs(h));
  return fadeLen * fadeW;
}
// 지면 UI 텍스트 마스크 — 제목·SPM·페이스가 앉은 구간에선 토큰 광을 깎는다.
//   토큰이 글자 위를 지나 가독성을 무너뜨리던 것(유저)의 해법. 흰 판을 덧대 뒤를 가리는 게
//   아니라 '그 자리엔 애초에 안 쏜다' — 빔은 빛을 더할 뿐이라 이쪽이 물리적으로도 맞다.
//   경계는 smoothstep 페더로 뭉갠다(= 블러 마스크). uUIAmt 0 이면 완전 무효.
float uiMaskFade(vec3 wp) {
  if (uUIAmt < 0.004) return 1.0;
  vec2 rel = wp.xz - uUIOrigin.xz;
  float d = rel.x * uUIFwd.x + rel.y * uUIFwd.z;      // 프레임 세로축
  float h = rel.x * uUIRight.x + rel.y * uUIRight.z;  // 프레임 가로축
  float f = max(uUIFeather, 0.001);
  float mL = 1.0 - smoothstep(uUIHalfL - f, uUIHalfL + f, abs(d));
  float mW = 1.0 - smoothstep(uUIHalfW - f, uUIHalfW + f, abs(h));
  return 1.0 - mL * mW * uUIAmt;
}
// 컴포저 OutputPass가 전 화면에 linear→sRGB 인코딩을 얹음(장면 PBR엔 옳지만 토큰 광은
// 카탈로그(raw)보다 미드톤이 ~30% 들떠 보임 — 패리티 하니스로 실측). 장면 파이프라인은
// 유지하고 토큰만 출력 직전 역변환으로 상쇄(uOut=1). raw 컨텍스트(패리티)는 uOut=0.
vec3 toLin(vec3 c){ return mix(c / 12.92, pow((c + 0.055) / 1.055, vec3(2.4)), step(0.04045, c)); }
void main() {
  #include <clipping_planes_fragment>
  vec2 uv = (vUv - 0.5) * 2.0;
  // 라이브 판정 상태(uPhase) → 카탈로그 상태 번호 매핑 (fx-core MARK_GLSL 기준):
  //   0 Preview·1 Active·2 Success→3·3 Locked→6·4 Miss·5 Hold→2·6 Warning→5
  float st = uPhase < 0.5 ? 0.0 : uPhase < 1.5 ? 1.0 : uPhase < 2.5 ? 3.0
           : uPhase < 3.5 ? 6.0 : uPhase < 4.5 ? 4.0 : uPhase < 5.5 ? 2.0 : 5.0;
  // Preview의 진행: 카탈로그 데모시계(숨쉬기)가 바닥 — 구동자 없는 라이브 Preview가
  // prog=0에 얼어붙어 '얇은 정지 외곽선'(카탈로그에 없는 모습)으로 보이던 것의 근본 해결.
  // uStrong(다음 마크 강조)·uProg(판정 구동)는 max로 그 위에 얹힘.
  float breath = smoothstep(0.10, 0.88, fract(uTime * 0.45));
  float prog = uPhase < 0.5 ? max(breath, max(uStrong, uProg)) : clamp(uProg, 0.0, 1.0);
  vec4 r = markState(uv, st, prog, uStrong, uTime);
  // 쿼드 가장자리 페이드 — 헤일로·파동이 판 경계에 닿으면 '잘린 날'이 생긴다(유저 #113).
  //   경계 10% 구간에서 소멸시켜 어떤 상태·어떤 크기에서도 하드 컷이 없다.
  float edgeF = smoothstep(1.0, 0.90, max(abs(uv.x), abs(uv.y)));
  r *= edgeF;
  // ── 상태 크로스페이드(유저: 색만 띡 하고 바뀜) — 이전 상태를 한 번 더 평가해 0.28s 이지로 섞는다.
  //   markState 는 순수 함수라 두 번 호출이 안전하고, 전환이 끝나면(uXfade 1) 비용 0.
  if (uXfade < 0.999) {
    float stP = uStatePrev < 0.5 ? 0.0 : uStatePrev < 1.5 ? 1.0 : uStatePrev < 2.5 ? 3.0
              : uStatePrev < 3.5 ? 6.0 : uStatePrev < 4.5 ? 4.0 : uStatePrev < 5.5 ? 2.0 : 5.0;
    float progP = uStatePrev < 0.5 ? max(breath, uStrong) : clamp(uPrevProg, 0.0, 1.0);
    vec4 rp = markState(uv, stP, progP, uStrong, uTime);
    float k = smoothstep(0.0, 1.0, clamp(uXfade, 0.0, 1.0));
    r = mix(rp, r, k);
  }
  // ── 하프톤 스킨 (uHT) — FX Lab 후보랩에서 확정한 '그라디언트 + 하프톤 마스크' ─────────
  //   정본 색(OKLab 램프)은 그대로 두고 균일한 점으로 뚫는다. 재현이 아니라 이식이다.
  //   ★ 알파를 r 에서 받지 않는다. r 의 알파는 경계에서 급히 끊겨, 그걸 곱하면 경계에 걸친
  //     점이 '잘려' 아웃라인이 생긴다. 색만 빌리고 알파는 넓은 페이드 × 점 마스크로 새로 만든다.
  if (uHT > 0.5) {
    float u1h  = mkUndul(atan(uv.y, uv.x) + uSeed, uTime * 1.6);
    float sdh  = mkSD(uv, u1h);
    float pit  = max(uHTPitch, 0.02);
    vec2  c2   = fract(uv / pit) - 0.5;
    float dd   = length(c2) * pit;
    float edge = smoothstep(0.20 * max(uHTSoft, 0.20), -0.04, sdh);
    // 파형 — 좁은 파면이 바깥으로 달리며 그 자리 점만 굵어진다(랩 '파형' 슬라이더).
    //   나머지 점은 제자리라 꿈틀거리지 않는다. uHTWave 0 이면 완전히 정지.
    float ext2 = uShape < 0.5 ? 0.46 * uRadius : 0.72;
    // 하프톤 파형도 실루엣 등거리선을 따른다 — 예전엔 length(uv) 라 **발 위에 원형 파장**이
    // 얹혀 형태와 따로 놀았다(유저 지적). sdh 는 윤곽에서 0 이므로 ext2 를 더하면 같은 대역이 된다.
    float rr2  = sdh + ext2;
    float fr   = fract(uTime * 0.40) * (ext2 * 2.30);
    float band = exp(-pow((rr2 - fr) / max(ext2 * 0.30, 1e-3), 2.0)) * (1.0 - fr * 0.20) * uHTWave;
    float rad  = pit * 0.5 * clamp((0.62 + 0.30 * band) * uHTGain * edge, 0.0, 1.0);
    // ── 글리프 구멍(임시) — 숫자 텍스처를 읽어 '그 점을 통째로' 뺀다 ────────────────
    //   ★ 격자는 셰이더가 깔았으니 셀 중심에서 읽어야 위상이 안 어긋난다.
    //     (마스크 쪽에서 뚫었다가 격자가 어긋나 역상이 나던 것의 교훈)
    //   숫자 평면은 쿼드의 MARK_NUM.RATIO/0.75 배 = 0.311 배를 차지한다(setNumber 규약).
    if (uNumOn > 0.5) {
      vec2 cc = (floor(uv / pit) + 0.5) * pit;                 // 이 점의 중심(uv)
      vec2 nq = (cc - uNumOff) / max(uNumScale, 1e-3) * 0.5 + 0.5;
      float inN = 0.0;
      if (nq.x > 0.0 && nq.x < 1.0 && nq.y > 0.0 && nq.y < 1.0)
        inN = texture2D(uNumTex, vec2(nq.x, 1.0 - nq.y)).a;
      rad *= 1.0 - smoothstep(0.25, 0.75, inN);                 // 글자 안이면 점이 사라진다
    }
    float m    = smoothstep(rad + pit * 0.11, rad - pit * 0.11, dd);
    // 닷 글로우 — 굵고 흐릿한 점을 아래에 깔아 더한다(랩 '닷 글로우'). 0 이면 완전히 꺼진다.
    if (uHTGlow > 0.001) {
      float rg = pit * 0.5 * clamp((0.62 + 0.30 * band) * uHTGain * 1.5 * edge, 0.0, 1.0);
      float hg = smoothstep(rg + pit * 0.36, rg - pit * 0.36, dd);
      m = clamp(m + hg * uHTGlow * 0.6, 0.0, 1.0);
    }
    float soft = smoothstep(0.13 * max(uHTSoft, 0.20), -0.05, sdh);
    float aOld = max(r.a, 1e-4);
    vec3  c0   = r.rgb / aOld;                 // 정본 색(언프리멀티)
    float aNew = clamp(soft * m, 0.0, 1.0);
    // 이너 음영 — 끝에서 최대, 안으로 급감(랩 '이너 음영'). +글로우 / −섀도우.
    if (abs(uHTInner) > 0.001) {
      float dep = clamp(-sdh / max(0.55 * uHTSoft, 1e-4), 0.0, 1.0);
      float ee  = pow(1.0 - dep, 2.4);
      aNew = clamp(aNew * (uHTInner > 0.0 ? mix(1.0, 1.0 + 0.80 * uHTInner, ee)
                                          : mix(1.0, 1.0 + 0.72 * uHTInner, ee)), 0.0, 1.0);
    }
    r = vec4(c0 * aNew, aNew);
  }
  // 쿼드 보더 페이드 — 원형 + 사각 경계(체비셰프) 이중: 어떤 경로에서도 평면 모서리가
  // 사각 박스로 드러나지 않게 (주간 잉크의 색 정규화가 원형 페이드를 상쇄하던 구멍 봉인)
  float border = smoothstep(1.0, 0.82, length(uv))
               * smoothstep(1.0, 0.84, max(abs(uv.x), abs(uv.y)))
               * footprintFade(vWorldPos)    // 투사면 밖으로 새는 글로우를 사각 하드컷 전에 페이드
               * uiMaskFade(vWorldPos);      // 지면 UI 텍스트 구간 = 토큰 광을 블러 마스크로 깎음
  vec3 col = r.rgb * uFade * uGain * border;
  // 앞꿈치 접지: 접지면(앞)만 남기고 뒤꿈치는 스러진다. 앞쪽은 조금 더 달궈 강조(유저).
  if (uToe > 0.001) {
    float toe = smoothstep(-0.80, 0.20, uv.y);
    col *= mix(1.0, toe * (1.0 + 0.55 * toe), uToe);
  }
  if (uDay > 0.5) {   // 주간 = 풀컬러 잉크 (색 보존 + 커버리지 알파)
    float mc = max(col.r, max(col.g, col.b));
    vec3 ink = col / max(mc, 1e-4);
    // ★ 커버리지(알파)가 **밝기에 묶여** 있다. 바닥 토큰의 밝기는 순번 페이드(uFade
    //   0.75/0.55/0.38) · uGain · 쿼드 보더 · 투사면 페이드를 다 지나 도착하는데, 벽엔 그
    //   감쇠 스택이 없다. 그래서 같은 잉크 모드인데도 벽은 쨍하고 바닥만 물빠진 것처럼 보였다
    //   (유저: "왜 벽면 채도는 쨍하고 바닥은 흐리멍텅해"). 색이 아니라 **덮는 양**의 문제다.
    //   배수를 올려 감쇠를 지나온 뒤에도 잔디를 제대로 덮게 한다. 색(ink)은 그대로다.
    gl_FragColor = vec4(uOut > 0.5 ? toLin(ink) : ink, clamp(mc * 2.30, 0.0, 1.0) * border);
  } else {
    gl_FragColor = vec4(uOut > 0.5 ? toLin(col) : col, 1.0);   // 야간: 가산 광
  }
}`,ea=`
#include <common>
#include <clipping_planes_pars_fragment>
`+At+`
uniform float uTime, uLen, uW, uHalo, uGain, uDay;
uniform float uLStyle, uLSpeed, uLGap, uLHeat, uLTail, uOut;
// 풋프린트(투사면) 로컬 좌표계 — 무릎 원점 + 전방/우측 단위벡터(월드). 레인은 월드 고정
// 지오메트리라 매 프레임 러너가 지나가는 부분만 GPU 클리핑(floorClip)으로 하드컷됐는데,
// 가산 글로우가 꼬리 없이 뚝 잘려 사각형 프레임처럼 보였음(유저 스크린샷으로 확인).
// 클리핑 자체(투사 경계 밖 금지)는 원칙대로 유지하되, 그 경계에 닿기 전에 셰이더에서
// 먼저 알파를 죽여 하드컷이 안 보이게 한다.
uniform vec3 uFPOrigin, uFPFwd, uFPRight;
uniform float uFPNear, uFPFar, uFPHalfN, uFPHalfF, uFPFadeM;
varying vec2 vUv;
varying vec3 vWorldPos;
float footprintFade(vec3 wp) {
  vec2 rel = wp.xz - uFPOrigin.xz;
  float d = rel.x * uFPFwd.x + rel.y * uFPFwd.z;
  float h = rel.x * uFPRight.x + rel.y * uFPRight.z;
  float half_ = mix(uFPHalfN, uFPHalfF, clamp((d - uFPNear) / max(0.01, uFPFar - uFPNear), 0.0, 1.0));
  float fadeLen = smoothstep(uFPNear, uFPNear + uFPFadeM, d) * smoothstep(uFPFar, uFPFar - uFPFadeM, d);
  float fadeW = smoothstep(half_, half_ - uFPFadeM, abs(h));
  return fadeLen * fadeW;
}
void main() {
  #include <clipping_planes_fragment>
  float fpFade = footprintFade(vWorldPos);
  float lat = (vUv.x - 0.5) * 2.0;                     // 폭방향 -1..1
  float along = vUv.y * uLen;                          // 진행 좌표 (m)
  float heat;
  if (uLStyle > 0.5 && uLStyle < 1.5) {                // dash — 흐르는 캡슐 대시 (팩 레인 등 일반 dash)
    float baseW = 0.08 * uW;
    float base = exp(-pow(lat / baseW, 2.0)) + exp(-pow(lat / (baseW * 3.5), 2.0)) * 0.22 * uHalo;
    float ph = fract(along * (1.7 / uLGap) - uTime * 1.35 * uLSpeed);
    float cap = smoothstep(0.06, 0.24, ph) * smoothstep(0.60, 0.40, ph);
    float lead = smoothstep(0.34, 0.46, ph);
    float dashLat = exp(-pow(lat / (0.10 * uW), 2.0)) + exp(-pow(lat / (0.34 * uW), 2.0)) * 0.28 * uHalo;
    heat = base * 0.30 + cap * dashLat * (0.8 + 0.55 * lead);
  } else {
    lat += sin(along * 2.1 + uTime * 1.4) * 0.06;      // 미세 측면 웨이브
    float pulse = 1.0;
    float latEff = lat;
    float wEff = uW;
    if (uLStyle < 0.5) {                               // solid — 연속 광류 (은은한 명멸)
      pulse = 0.55 + 0.25 * sin(along * 0.8 - uTime * 2.0 * uLSpeed);
    } else if (uLStyle < 2.5) {                        // dot — 짧고 또렷한 점 행진
      pulse = smoothstep(0.75, 0.95, 0.5 + 0.5 * sin(along * (12.0 / uLGap) - uTime * 5.2 * uLSpeed));
      wEff *= 1.3;
    } else if (uLStyle < 3.5) {                        // chevron — 크리스프 화살촉 트레인 (프리미엄)
      float alongEff = along + abs(lat) * 0.42;         // 팔이 뒤로 = 촉이 전방(-z 진행 방향)
      float cf = fract(alongEff * (1.28 / uLGap) - uTime * 1.15 * uLSpeed);
      // 무른 가우시안 획 → 정의된 엣지: 크리스프 앞선(화이트-핫) + 채운 몸통 + 짧은 트레일.
      float edge = smoothstep(0.0, 0.022, cf) * smoothstep(0.12, 0.07, cf);   // 밝은 앞선
      float body = smoothstep(0.02, 0.06, cf) * smoothstep(0.44, 0.20, cf);   // 채운 몸통
      float armW = smoothstep(1.0, 0.80, abs(lat)) * smoothstep(0.995, 0.90, abs(lat)); // 크리스프 레인 엣지
      pulse = armW * (edge * 3.4 + body * 0.85);        // 앞선 고강도 → LUT 상단(화이트-핫)으로 크리스프
      latEff = 0.0;                                     // 형상은 edge/body가 담당 (코어 가우시안 무력화)
    } else if (uLStyle < 4.5) {                        // comet — 백열 머리 + 감쇠 꼬리 순회
      float head = fract(uTime * 0.22 * uLSpeed) * uLen;
      float d = head - along;
      if (d < 0.0) d += uLen;
      float f = exp(-d / max(0.4, uLen * uLTail * 0.6));
      pulse = f * 1.6 + 0.10;
      wEff *= (0.7 + f * 0.9);
    } else {                                           // taper — 전방으로 갈수록 넓게
      wEff *= (0.35 + vUv.y * 1.4);
      pulse = 0.5 + 0.2 * sin(along * 0.8 - uTime * 1.6 * uLSpeed);
    }
    float core = exp(-pow(latEff / (0.10 * wEff), 2.0)) + exp(-pow(latEff / (0.42 * wEff), 2.0)) * 0.30 * uHalo;
    heat = core * pulse * 0.5;
  }
  heat *= smoothstep(0.0, 0.04, vUv.y) * smoothstep(1.0, 0.96, vUv.y);
  heat *= fpFade;   // 풋프린트 경계 소프트 페이드 — 뒤이은 GPU 하드클립 전에 이미 0 근처
  float sweep = 0.12 * sin(along * 0.9 - uTime * 1.7);
  vec3 col = lut(clamp(uLHeat - 0.08 + sweep + heat * 0.25, 0.0, 1.0)) * heat * uGain;
  vec3 outLin = mix(col / 12.92, pow((col + 0.055) / 1.055, vec3(2.4)), step(0.04045, col));
  vec3 co = uOut > 0.5 ? outLin : col;   // OutputPass 인코딩 상쇄 (MARKFX와 동일 규약)
  if (uDay > 0.5) {   // 주간 = 풀컬러 잉크 (MARKFX와 동일 규약)
    float mc = max(co.r, max(co.g, co.b));
    gl_FragColor = vec4(co / max(mc, 1e-4), clamp(max(col.r, max(col.g, col.b)) * 1.45, 0.0, 1.0));
  } else {
    gl_FragColor = vec4(co, 1.0);
  }
}`,ta={solid:0,dash:1,dot:2,chevron:3,comet:4,taper:5},Z={ox:0,oz:0,fx:0,fz:-1,rx:1,rz:0,halfL:0,halfW:0,feather:.3,amt:0};function ia(r){const e=new q({vertexShader:It,fragmentShader:ea,uniforms:{uLUT:{value:De()},uTime:{value:0},uLen:{value:r},uW:{value:1},uHalo:{value:.9},uGain:{value:1},uLStyle:{value:1},uLSpeed:{value:1},uLGap:{value:1},uLHeat:{value:.5},uLTail:{value:.55},uDay:{value:0},uOut:{value:1},uFPOrigin:{value:new y},uFPFwd:{value:new y(0,0,-1)},uFPRight:{value:new y(1,0,0)},uFPNear:{value:-1e6},uFPFar:{value:1e6},uFPHalfN:{value:1e6},uFPHalfF:{value:1e6},uFPFadeM:{value:.15}},transparent:!0,blending:pe,depthWrite:!1,side:tt});return e.clipping=!0,e._src="LANEFX",e}const he=je/Ke,J={core:w.w,halo:w.halo,pool:w.pool,sweep:.4,wobble:w.noise,tap:w.tap||null};if(w.prims){P.prims=P.prims||{};for(const r in w.prims)P.prims[r]={...P.prims[r]||{},...w.prims[r]}}P.primBloom=w.bloom;function aa(r=null){const e=new q({vertexShader:It,fragmentShader:Ji,uniforms:{uLUT:{value:De()},uUIOrigin:{value:new y},uUIFwd:{value:new y(0,0,-1)},uUIRight:{value:new y(1,0,0)},uUIHalfL:{value:0},uUIHalfW:{value:0},uUIFeather:{value:.3},uUIAmt:{value:0},uShape:{value:r?1:0},uRadius:{value:r?1:1.5652173913043477},uSDF2:{value:r||De()},uSDFWarn:{value:Jt()||De()},uImp:{value:r?w.imp:0},uImpPitch:{value:w.pitch*he},uImpDot:{value:w.dot},uImpGlow:{value:w.glow},uImpShade:{value:w.shade},uImpSharp:{value:w.sharp},uImpShadeCol:{value:w.shadeCol},uImpDotCol:{value:w.dotCol},uImpEdge:{value:w.edge*he},uImpScale:{value:w.scale},uImpRot:{value:(r?._right?-5.5:w.irot)*Math.PI/180},uImpCtr:{value:new M(r?(r._inCx??.5)*2-1:0,r?1-(r._inCy??.5)*2:0)},uImpOff:{value:new M((r?._right?.043:w.offx)*he,w.offy*he)},uRip:{value:w.rip},uRipSpeed:{value:w.ripSpeed},uRipWidth:{value:w.ripWidth*he},uRipReach:{value:w.ripReach*he},uEdgeShade:{value:w.edgeShade},uEdgeW:{value:w.edgeW*he},uEdgeSoft:{value:w.edgeSoft},uEdgeShadeW:{value:w.edgeShadeW},uEdgeShadeCol:{value:w.edgeShadeCol},uIceOld:{value:0},uStatePrev:{value:0},uPrevProg:{value:0},uXfade:{value:1},uEdgeShadeGrad:{value:w.edgeShadeGrad},uEdgeShadeG0:{value:w.edgeShadeG0},uEdgeShadeG1:{value:w.edgeShadeG1},uShadeRed:{value:w.shadeRed},uShadeRedW:{value:w.shadeRedW},uDither:{value:w.dither},uSilFit:{value:je/Ke},uPlantar:{value:w.plantar},uBands:{value:w.bands},uBandSoft:{value:w.bandSoft},uRipGrad:{value:w.ripGrad},uRipCol:{value:w.ripCol},uPhase:{value:0},uProg:{value:0},uFade:{value:1},uFillOp:{value:1},uToe:{value:0},uStrong:{value:0},uContract:{value:0},uTime:{value:0},uSeed:{value:Math.random()*6.2832},uW:{value:1},uHalo:{value:.9},uPool:{value:.55},uGain:{value:1},uSweepA:{value:1},uNoise:{value:.5},uDay:{value:0},uOut:{value:1},uHT:{value:0},uHTPitch:{value:.055},uHTGain:{value:1.15},uHTSoft:{value:.55},uHTWave:{value:.6},uHTGlow:{value:0},uHTInner:{value:0},uNumTex:{value:null},uNumOn:{value:0},uNumScale:{value:.311},uNumOff:{value:new M},uFPOrigin:{value:new y},uFPFwd:{value:new y(0,0,-1)},uFPRight:{value:new y(1,0,0)},uFPNear:{value:-1e6},uFPFar:{value:1e6},uFPHalfN:{value:1e6},uFPHalfF:{value:1e6},uFPFadeM:{value:.28}},transparent:!0,blending:pe,depthWrite:!1,side:tt});return e.clipping=!0,e._src=r?"MARKFX(발형)":"MARKFX(존원)",e._noBloom=!0,Nt.push(e),e}const Nt=[];function Ct(r,e={}){const t=je/Ke,a={imp:"uImp",dot:"uImpDot",glow:"uImpGlow",shade:"uImpShade",sharp:"uImpSharp",shadeCol:"uImpShadeCol",dotCol:"uImpDotCol",scale:"uImpScale",plantar:"uPlantar",bands:"uBands",bandSoft:"uBandSoft",edgeShade:"uEdgeShade",edgeShadeW:"uEdgeShadeW",edgeShadeCol:"uEdgeShadeCol",edgeShadeGrad:"uEdgeShadeGrad",edgeShadeG0:"uEdgeShadeG0",edgeShadeG1:"uEdgeShadeG1",shadeRed:"uShadeRed",shadeRedW:"uShadeRedW",edgeSoft:"uEdgeSoft",dither:"uDither",rip:"uRip",ripSpeed:"uRipSpeed",ripGrad:"uRipGrad",ripCol:"uRipCol",op:"uFillOp",halo:"uHalo",w:"uW",pool:"uPool",noise:"uNoise"},o={pitch:"uImpPitch",edge:"uImpEdge",edgeW:"uEdgeW",ripWidth:"uRipWidth",ripReach:"uRipReach"},i=r.uniforms;for(const s in a)e[s]!=null&&i[a[s]]&&(i[a[s]].value=e[s]);for(const s in o)e[s]!=null&&i[o[s]]&&(i[o[s]].value=e[s]*t)}const qe=new WeakMap;function sa(r,e){if(!r?.uniforms)return;const t=(w.states||{})[e]||(w.states||{})[String(e)],a=["imp","dot","glow","shade","sharp","scale","plantar","bands","bandSoft","edgeShade","edgeShadeW","edgeShadeGrad","edgeShadeG0","edgeShadeG1","dither","pitch","edge","edgeW"];if(!qe.has(r)){const o={};for(const i of a)w[i]!=null&&(o[i]=w[i]);qe.set(r,o)}Ct(r,qe.get(r)),t&&Ct(r,t)}function wa(r={}){const e=je/Ke,t={imp:"uImp",dot:"uImpDot",glow:"uImpGlow",shade:"uImpShade",sharp:"uImpSharp",shadeCol:"uImpShadeCol",dotCol:"uImpDotCol",scale:"uImpScale",plantar:"uPlantar",bands:"uBands",bandSoft:"uBandSoft",edgeShade:"uEdgeShade",edgeShadeW:"uEdgeShadeW",edgeShadeCol:"uEdgeShadeCol",edgeShadeGrad:"uEdgeShadeGrad",edgeShadeG0:"uEdgeShadeG0",edgeShadeG1:"uEdgeShadeG1",shadeRed:"uShadeRed",shadeRedW:"uShadeRedW",edgeSoft:"uEdgeSoft",dither:"uDither",rip:"uRip",ripSpeed:"uRipSpeed",ripGrad:"uRipGrad",ripCol:"uRipCol",iceOld:"uIceOld"},a={pitch:"uImpPitch",edge:"uImpEdge",edgeW:"uEdgeW",ripWidth:"uRipWidth",ripReach:"uRipReach"};for(const o of Nt){const i=o.uniforms,s=i.uShape?.value===1;for(const l in t)r[l]==null||!i[t[l]]||l==="imp"&&!s||(i[t[l]].value=r[l]);for(const l in a)r[l]!=null&&i[a[l]]&&(i[a[l]].value=r[l]*e)}if(r.halo!=null&&(P.mark.halo=r.halo),r.w!=null&&(P.mark.core=r.w,P.arrow&&(P.arrow.w=r.w)),r.w!=null&&(J.core=r.w),r.halo!=null&&(J.halo=r.halo),r.pool!=null&&(J.pool=r.pool),r.noise!=null&&(J.wobble=r.noise),r.bloom!=null&&(P.primBloom=r.bloom),r.prims){P.prims=P.prims||{};for(const o in r.prims)P.prims[o]={...P.prims[o]||{},...r.prims[o]}}}const oe={left:ne.red,right:ne.red,target:ne.red,guide:ne.coral,lane:ne.red,success:ne.prism,user:ne.prism},Ut=[1,.75,.55,.38],oa=typeof location>"u"||new URLSearchParams(location.search).get("xfade")!=="0",ra=[1,.78,.58,.42];let Be=!1;function xa(r){Be=!!r}const et=.3,na=.727,Rt=et/na,$e={base:et*.65,loose:et*1},be={markScale:1,fillOpacity:.2,previewEdge:.5,cdContractFrom:1.9,cdGain:.6,lingerEdge:.9,linger:.35};be.linger;const la={running:{mode:"advance",V:2.5,STRIKE_AHEAD:.15,X_SCALE:2,LANE_W:1.6,CAL:{right:{x:-.187,z:.049},left:{x:.128,z:0}}},boxing:{mode:"static",FLOOR_SCALE:1.6,WALL:{XS:2.2,Y0:.73,YS:1.2}},basketball:{mode:"spatial",SCALE:5}},ba=5,Je={},_e=new Image;_e.src="./ready-view/assets/pace_foot.svg";function ha(r){const e=r?"R":"L";if(Je[e])return Je[e];const t=document.createElement("canvas");t.width=t.height=128;const a=t.getContext("2d"),o=_e.complete&&_e.naturalWidth;if(o){const s=document.createElement("canvas");s.width=s.height=128;const l=s.getContext("2d"),h=_e.naturalWidth/_e.naturalHeight,d=100,n=d/h;l.save(),r&&(l.translate(128,0),l.scale(-1,1)),l.drawImage(_e,(128-d)/2,(128-n)/2,d,n),l.restore(),l.globalCompositeOperation="source-in",l.fillStyle=ue(ze.ink,.95),l.fillRect(0,0,128,128),a.shadowColor=ue(He.coral,.75),a.shadowBlur=12,a.drawImage(s,0,0),a.shadowBlur=0,a.drawImage(s,0,0)}else a.strokeStyle=ue(ze.ink,.95),a.lineWidth=5,a.shadowColor=ue(He.coral,.75),a.shadowBlur=12,a.beginPath(),a.ellipse(64,64,20,34,r?.12:-.12,0,Math.PI*2),a.stroke();const i=new X(t);return i.colorSpace=Q,i.anisotropy=4,o&&(Je[e]=i),i}function Ht(r){const e=document.createElement("canvas");e.width=e.height=128;const t=e.getContext("2d");Dt(t,String(r),64,64,96)||(t.fillStyle=ue(ze.ink,.95),t.font="300 86px -apple-system, sans-serif",t.textAlign="center",t.textBaseline="middle",t.shadowColor=ue(He.coral,.75),t.shadowBlur=14,t.fillText(String(r),64,70));const a=new X(e);return a.anisotropy=4,a}function ua(r){const a=document.createElement("canvas");a.width=4,a.height=4;let o=a.getContext("2d");o.font="400 56px -apple-system, 'Apple SD Gothic Neo', sans-serif";const i=Math.ceil(o.measureText(r).width);a.width=i+40,a.height=56*1.7,o=a.getContext("2d"),o.font="400 56px -apple-system, 'Apple SD Gothic Neo', sans-serif",o.textAlign="center",o.textBaseline="middle",o.shadowColor=ue(He.coral,.7),o.shadowBlur=56*.25,o.fillStyle=ze.ink,o.fillText(r,a.width/2,a.height/2);const s=new X(a);return s.colorSpace=Q,s.anisotropy=8,{tex:s,aspect:a.width/a.height}}function ca(r){const e=document.createElement("canvas");e.width=e.height=256;const t=e.getContext("2d"),a="#"+r.toString(16).padStart(6,"0");return t.strokeStyle=a,t.lineWidth=12,t.lineCap="butt",t.setLineDash([26,20]),t.beginPath(),t.arc(128,128,104,0,Math.PI*2),t.stroke(),new X(e)}class Et{constructor(e,t,a,o=!1){this._footRight=o,this.group=new j,this.radius=e,this.color=t,this.surface=a,this.num=null;let i=null;if(a==="floor"&&P.markShape===1)try{i=ei(this._footRight===!0)}catch{i=null}this._isFoot=!!i;const s=(this._isFoot?Rt:e*2.78)*St;this.fx=new k(new K(s,s),aa(i)),this.fx.position.z=.002,this._baseGain=a==="wall"?.6:1,this.fx.material.uniforms.uGain.value=this._baseGain,this.group.add(this.fx),a==="floor"&&(this.group.rotation.x=-Math.PI/2,this.group.position.y=.012),this.group.renderOrder=5}setSelected(e){if(e&&!this.sel){this.sel=new j;const t=(a,o,i,s,l)=>{const h=new k(new Fi(a,o,48),new de({color:i,transparent:!0,opacity:s,depthWrite:!1,side:tt}));return h.renderOrder=l,h};this.sel.add(t(this.radius*1.44,this.radius*1.58,790034,.85,6)),this.sel.add(t(this.radius*1.32,this.radius*1.44,16777215,.95,7)),this.sel.position.z=.005,this.group.add(this.sel)}this.sel&&(this.sel.visible=!!e)}setNumber(e){this._numN=e;const t=new de({map:Ht(e),transparent:!0,depthWrite:!1}),a=this.radius*2.78*yt.RATIO/.75*(this._isFoot?1:Ri);this.num=new k(new K(a,a),t),this.num.position.z=.004;const o=this.fx?.material?.uniforms;o?.uNumTex&&(o.uNumTex.value=t.map,o.uNumScale.value=a/(this.radius*2.78)),this.group.add(this.num)}setContract(e="reach"){this.contract=e,this.fx.material.uniforms.uContract.value=e==="avoid"?1:0}render(e,t,a,o){const i=this.group;if(e==="hidden"){i.visible=!1,this._lastPhase="hidden";return}i.visible=!0;const s=performance.now()/1e3;e!==this._lastPhase&&((this._lastPhase==="hidden"||this._lastPhase==null)&&(e==="preview"||e==="countdown")&&(this._spawnT=s),e==="linger"&&(this._hitT=s),this._lastPhase=e);let l=1;if(this._spawnT!=null){const n=(s-this._spawnT)/.38;if(n<1){const _=1-Math.pow(1-n,3);l*=.55+.45*_+.1*Math.sin(Math.min(1,n)*Math.PI)}}if(this._hitT!=null){const n=(s-this._hitT)/.3;n<1&&(l*=1+.3*(1-n)*(1-n))}i.scale.setScalar(o*be.markScale*l);const h=Be?ra:Ut,d=h[Math.min(a,h.length-1)];if(this.fx.visible){const n=this.fx.material.uniforms;n.uTime.value=performance.now()/1e3;const _=e==="preview"?0:e==="countdown"?1:e==="locked"?3:e==="miss"?4:2;if(n.uPhase.value!==_&&oa&&(n.uStatePrev.value=n.uPhase.value,n.uPrevProg.value=n.uProg.value,this._xfT=s),n.uPhase.value=_,sa(this.fx?.material||m,_),this._xfT!=null){const D=(s-this._xfT)/.28;n.uXfade.value=D>=1?1:D,D>=1&&(this._xfT=null)}n.uProg.value=t,n.uFade.value=d,n.uStrong.value=this.strongPreview?1:0,n.uW.value=J.core,n.uHalo.value=J.halo,n.uPool.value=J.pool,n.uSweepA.value=J.sweep,n.uNoise.value=J.wobble,n.uUIAmt&&(n.uUIOrigin.value.set(Z.ox,0,Z.oz),n.uUIFwd.value.set(Z.fx,0,Z.fz),n.uUIRight.value.set(Z.rx,0,Z.rz),n.uUIHalfL.value=Z.halfL,n.uUIHalfW.value=Z.halfW,n.uUIFeather.value=Z.feather,n.uUIAmt.value=this.surface==="wall"?0:Z.amt);const c=e==="linger"?1+.9*Math.max(0,1-t*2.2):1;n.uGain.value=this._baseGain*P.gainBoost*(Be?1.35:1)*c;const x=P.day||P.markBlend==="ink"?1:0;n.uDay.value!==x&&(n.uDay.value=x,this.fx.material.blending=x?it:pe,this.fx.material.needsUpdate=!0)}if(this.num&&(this.num.material.opacity=P.hideOrderNums&&!this._numFoot?0:e==="preview"?(this.strongPreview?1:.5)*d:e==="countdown"?1:e==="linger"?.4*(1-t):e==="locked"?.48*d:e==="miss"?.3*(1-t):1),this.num&&this.fx?.material?.uniforms?.uHT){const n=this.fx.material.uniforms,_=n.uHT.value>.5;n.uNumOn.value=_&&this.num.material.opacity>.01?1:0,n.uNumOff.value.set(this.num.position.x/(this.radius*1.39),this.num.position.y/(this.radius*1.39)),_?this.num.visible=!1:this.num.visible||(this.num.visible=!0)}if(this.num&&this._isFoot&&P.numFoot){const n=P.numFoot,_=n[P.footCtx==="in"?"in":"out"]||n.L||(n.R?{x:1-n.R.x,y:n.R.y,s:n.R.s}:null);if(_){const c=yt.anchor(_,this._footRight,Rt*St);this.num.position.set(c.x,c.y,.004),this.num.scale.setScalar(c.s)}}}}const Ue=[];function Lt(r,{tips:e=1,wall:t=!1,scale:a=1,dots:o}={}){const i=new j,s=document.createElement("canvas");s.width=128,s.height=256;const l=new X(s);l.colorSpace=Q,l.anisotropy=4;const h=new k(new K(r*.5,r),new de({map:l,transparent:!0,depthWrite:!1,blending:pe}));return h.position.y=r/2,i.add(h),i._len=r,i._canvas=s,i._tex=l,i._mesh=h,i._paintT=-9,i._noTip=e===0,i._tips=[],i._scale=a,i._dots=o??!t,t?(i.rotation.x=0,i.position.y=0):(i.rotation.x=-Math.PI/2,i.position.y=.014),i.renderOrder=6,i._wall=!!t,Ue.push(i),i}function da(r,e,t=0){const a=r?._fp;if(!a)return 1;const o=(c,x,D)=>{const E=Math.max(0,Math.min(1,(D-c)/(x-c)));return E*E*(3-2*E)},i=.25+t,s=e.x-a.ox,l=e.z-a.oz,h=s*a.fx+l*a.fz,d=s*a.rx+l*a.rz,n=Math.max(0,Math.min(1,(h-r.fpNear)/Math.max(.01,r.fpFar-r.fpNear))),_=r._halfAt(r.fpNear)+(r._halfAt(r.fpFar)-r._halfAt(r.fpNear))*n;return o(r.fpNear,r.fpNear+i,h)*o(r.fpFar,r.fpFar-i,h)*o(_,_-i,Math.abs(d))}function Sa(r,e){se.map.TIP_TRI||(se.map.TIP_TRI="./ready-view/assets/arrow_tip.svg",se.set(se.map)),se.map.LIFT_TIP||(se.map.LIFT_TIP="./ready-view/assets/lift_tip.svg",se.set(se.map));const t=P.day||P.markBlend==="ink"?1:0,a={lut:ti,glyph:Dt,arrow:P.arrow||{}};for(let o=Ue.length-1;o>=0;o--){const i=Ue[o];if(!i.parent){Ue.splice(o,1);continue}r-i._paintT>=1/24&&(i._paintT=r,Ei(i._canvas.getContext("2d"),128,256,r,a,{noTip:i._noTip,prog:i._prog,scale:i._scale,dots:i._dots}),i._tex.needsUpdate=!0);const s=e?._fp,l=i._mesh.material;if(s&&!i._wall){const h=_=>da(e,_),d=new y,n=new y;i.getWorldPosition(d),i._mesh.getWorldPosition(n),n.multiplyScalar(2).sub(d),l.opacity=Math.min(h(d),h(n))*(i._gain??1)}else l.opacity=i._gain??1;l._day!==t&&(l._day=t,l.blending=t?it:pe,l.needsUpdate=!0)}}class ya{constructor(e,t){this.scene=e,this.effects=t,this.params={lead:.7,size:1,maxVisible:3},this.root=new j,e.add(this.root),this.floorRoot=new j,this.wallRoot=new j,this.root.add(this.floorRoot,this.wallRoot),this.events=[],this.ambient=[],this.pack=null,this.layout=null,this.duration=0,this.onEvent=null,this.footprintTest=null,this.gazeTest=null,this.stats={inGaze:0,total:0},this.floorClip=null,this.wallClip=null}_applyClip(e,t){t&&e.traverse(a=>{a.material&&(a.material.clippingPlanes=t)})}_floorClipFor(){return this.layoutPreview?null:this.floorClip}setCompare(e){if(this._compareRoot){for(const s of this._compareRoot)s.removeFromParent();this._compareRoot=null}if(!e||!this.pack||e.sport!==this.pack.sport)return;const t=new j,a=new j,o=ca(10134445),i=()=>new de({map:o,transparent:!0,opacity:.5,depthWrite:!1});for(const s of e.tokens)if(s.type==="stepMark"){const l=this._mapFloor(s),h=new k(new K(.4,.4),i());h.rotation.x=-Math.PI/2,h.position.set(l.x,.011,l.z),h.renderOrder=3,this._applyClip(h,this._floorClipFor()),t.add(h)}else if(s.type==="targetMark"&&this.pack.hasWall){const l=this._mapWall(s),h=new k(new K(.34,.34),i());h.position.set(l.x,l.y,l.z-.005),h.renderOrder=3,this._applyClip(h,this.wallClip),a.add(h)}this.floorRoot.add(t),this.wallRoot.add(a),this._compareRoot=[t,a]}recolor(){for(const e of this.events)if(e.marker){const t=oe[e.marker.role]??oe.left;e.marker.color=t,e.color=t}}setParams(e){Object.assign(this.params,e)}setPack(e){this.floorRoot.clear(),this.wallRoot.clear(),this._compareRoot=null,this.laneFX=null,this.floorRoot.position.set(0,0,0),this.events=[],this.ambient=[],this.pack=e,this.layout=la[e.sport],this.duration=e.duration;const t=this.layout,a=new Map;for(const i of e.tokens){if(i.type==="pathLane"||i.lifetime>=e.duration*.85){this.ambient.push(i);continue}const l=Math.round(i.t*1e3);a.has(l)||a.set(l,{t:i.t,tokens:[]}),a.get(l).tokens.push(i)}const o=e.sport==="boxing";for(const i of[...a.values()].sort((s,l)=>s.t-l.t)){const s={t:i.t,fired:!1,marker:null,arrow:null,surface:"floor",pos:new y,color:16777215,foot:null};let l=null;for(const h of i.tokens)if(!(o&&(h.type==="orderPulse"&&(l=h.n),h.type!=="targetMark"))){if(h.type==="stepMark"||h.type==="targetMark"||h.type==="orderPulse"&&!s.marker){const d=h.type==="targetMark"&&this.pack.hasWall,n=h.type==="targetMark"?oe.target:oe[h.foot]??oe.left,_=h.radiusCm?h.radiusCm/100:h.type==="targetMark"?$e.loose:$e.base,c=new Et(_,n,d?"wall":"floor",h.foot==="right");!d&&(h.contract&&h.contract!=="reach"||h.holdRing)&&c.setContract(h.contract),c.role=h.type==="targetMark"?"target":h.foot??"left",s.marker=c,s.surface=d?"wall":"floor",s.color=n,s.foot=h.foot??null,s.srcToken=h,(d?this.wallRoot:this.floorRoot).add(c.group),this._applyClip(c.group,d?this.wallClip:this._floorClipFor())}if(h.type==="orderPulse"&&s.marker&&!s.marker.num&&!s.marker._skipNumber&&s.marker.setNumber(h.n),h.type==="directionGuide"){const d=Lt(e.sport==="basketball"?.9:.55),n=this._mapFloor(h);d.position.x=n.x,d.position.z=n.z,d.rotation.z=Ot.degToRad(-(h.angle??0)),s.arrow={obj:d,t:h.t,lifetime:h.lifetime},this.floorRoot.add(d),this._applyClip(d,this._floorClipFor())}}o&&s.marker&&l!=null&&!s.marker.num&&(s.marker.setNumber(l),this._applyClip(s.marker.group,this.wallClip)),(s.marker||s.arrow)&&this.events.push(s)}if(e.sport==="basketball"){const i=this.events.filter(s=>s.surface==="floor"&&s.marker).sort((s,l)=>s.t-l.t);for(let s=0;s<i.length;s++){const l=i[s],h=i[s+1],d=i[s-1],n=this._mapFloor(l.srcToken);if(l.arrow&&h){const _=this._mapFloor(h.srcToken),c=_.x-n.x,x=_.z-n.z;l.arrow.obj.rotation.z=Math.atan2(-c,-x),l.arrow.obj.position.x=n.x,l.arrow.obj.position.z=n.z}if(d){const _=this._mapFloor(d.srcToken);let c=n.x-_.x,x=n.z-_.z;const D=Math.hypot(c,x)||1;c/=D,x/=D;const E=new j,C=Math.atan2(-c,-x);for(let R=0;R<3;R++){const F=Lt(.5,{tips:0});F.rotation.z=C+Math.PI/2,F.position.set(n.x-c*(.4+R*.24),.011,n.z-x*(.4+R*.24)),F.renderOrder=4,F._gain=.55-R*.13,E.add(F)}l.stripes=E,this.floorRoot.add(E),this._applyClip(E,this._floorClipFor())}}}for(const i of this.ambient)if(i.type==="pathLane"&&this._buildLane(e),i.type==="stepMark"&&!o){const s=new Et($e.base,oe[i.foot]??oe.left,"floor");s.role=i.foot??"left";const l=this._mapFloor(i);s.group.position.x=l.x,s.group.position.z=l.z,s.render("preview",0,0,1),s.isStance=!0,this.floorRoot.add(s.group),this._applyClip(s.group,this._floorClipFor()),this.stanceMarks=this.stanceMarks||[],this.stanceMarks.push(s)}{const i=(e.tokens||[]).filter(l=>l.type==="stepMark"&&l.t!=null).map(l=>l.t).sort((l,h)=>l-h),s=[];for(let l=1;l<i.length;l++){const h=i[l]-i[l-1];h>.05&&s.push(h)}s.sort((l,h)=>l-h),this._beatT=s.length?s[Math.floor(s.length/2)]:0,this._strideM=t.mode==="advance"&&this._beatT?t.V*this._beatT:0}if(o&&this.pack.hasWall){const i=this.events.filter(s=>s.surface==="wall"&&s.marker).sort((s,l)=>s.t-l.t);if(i.forEach((s,l)=>{!s.marker.num&&!s.marker._skipNumber&&s.marker.setNumber(l+1)}),i.length){const s=i.reduce((_,c)=>_+this._mapWall(c.srcToken).y,0)/i.length,l=this.layout.WALL,h=new xt(new We().setFromPoints([new y(-l.XS*.72,s,xe+.012),new y(l.XS*.72,s,xe+.012)]),new bt({color:16696201,dashSize:.05,gapSize:.07,transparent:!0,opacity:.3}));h.computeLineDistances(),this.wallRoot.add(h),this._applyClip(h,this.wallClip);const d=ua(`타깃 ${Math.round(s*100)}cm`),n=new k(new K(d.aspect*.075,.075),new de({map:d.tex,transparent:!0,opacity:.55,depthWrite:!1}));n.position.set(l.XS*.72-d.aspect*.075/2,s+.065,xe+.012),this.wallRoot.add(n),this._applyClip(n,this.wallClip)}}}_mapFloor(e){const t=this.layout;if(t.mode==="spatial")return{x:e.nx*t.SCALE,z:e.ny*t.SCALE};if(t.mode==="static")return{x:e.nx*t.FLOOR_SCALE,z:-e.ny*t.FLOOR_SCALE+(this.stanceOffsetZ||0)};const a=t.CAL&&t.CAL[e.foot]||{x:0,z:0};return{x:e.nx*t.X_SCALE+a.x,z:-t.V*e.t-t.STRIKE_AHEAD+a.z}}_mapWall(e){const t=this.layout.WALL;return{x:e.nx*t.XS,y:t.Y0+e.ny*t.YS,z:xe+.02}}_buildLane(e){const t=this.layout;if(t.mode==="advance"){const a=t.V*e.duration+3+1.2,o=new k(new K(.55,a),ia(a));o.rotation.x=-Math.PI/2,o.position.set(0,.01,1.2-a/2),o.renderOrder=3,this.floorRoot.add(o),this._applyClip(o,this._floorClipFor()),this.laneFX=o}else if(t.mode==="spatial"){const a=this.pack.tokens.filter(o=>o.type==="stepMark").sort((o,i)=>o.t-i.t).map(o=>new y(o.nx*t.SCALE,.012,o.ny*t.SCALE));if(a.length>=2){const o=new Mi(a),i=new We().setFromPoints(o.getPoints(60)),s=new xt(i,new bt({color:oe.lane,dashSize:.14,gapSize:.1,transparent:!0,opacity:.7}));s.computeLineDistances(),this.floorRoot.add(s),this._applyClip(s,this._floorClipFor())}}}resetLoop(){for(const e of this.events)e.fired=!1,e._wasVisible=!1,e._verdict=null;this.stats={inGaze:0,total:0}}setShake(e,t){this.floorRoot.position.x=e,this.floorRoot.position.z=t+(this.loopShiftZ||0)}update(e,t){const{lead:a,size:o,maxVisible:i}=this.params;if(!this.layout)return;if(this.laneFX){const n=this.laneFX.material.uniforms,_=P.arrow||{};if(n.uTime.value=performance.now()/1e3,n.uW.value=P.graphics.width*(_.w||1),n.uHalo.value=P.graphics.halo*(_.glow??1),n.uGain.value=P.gainBoost*(Be?1.25:1),n.uLStyle.value=ta[P.lane&&P.lane.style||"dash"]??1,n.uLSpeed.value=_.speed??1,n.uLGap.value=_.gap??1,this.pack?.sport==="running"&&this._beatT>0&&this._strideM>0){const D=n.uLStyle.value;if(D===1||D===2){const E=D===1?9:12;n.uLGap.value=E*this._strideM/(2*Math.PI),n.uLSpeed.value=2*Math.PI/(5.2*this._beatT)}}n.uLHeat.value=_.heat??.5,n.uLTail.value=_.tail??.55;const c=P.day||P.markBlend==="ink"?1:0;n.uDay.value!==c&&(n.uDay.value=c,this.laneFX.material.blending=c?it:pe,this.laneFX.material.needsUpdate=!0);const x=this.rig?._fp;x&&(n.uFPOrigin.value.set(x.ox,0,x.oz),n.uFPFwd.value.set(x.fx,0,x.fz),n.uFPRight.value.set(x.rx,0,x.rz),n.uFPNear.value=this.rig.fpNear,n.uFPFar.value=this.rig.fpFar,n.uFPHalfN.value=this.rig._halfAt(this.rig.fpNear),n.uFPHalfF.value=this.rig._halfAt(this.rig.fpFar))}const l=this.rig?._fp;if(l){const n=this.rig._halfAt(this.rig.fpNear),_=this.rig._halfAt(this.rig.fpFar);for(const c of this.events){const x=c.marker?.fx?.material?.uniforms;!x||!x.uFPNear||(x.uFPOrigin.value.set(l.ox,0,l.oz),x.uFPFwd.value.set(l.fx,0,l.fz),x.uFPRight.value.set(l.rx,0,l.rz),x.uFPNear.value=this.rig.fpNear,x.uFPFar.value=this.rig.fpFar,x.uFPHalfN.value=n,x.uFPHalfF.value=_)}}const h=this.events.filter(n=>n.t>=e-be.linger),d=new Map;h.forEach((n,_)=>d.set(n,_));for(const n of this.events){const _=d.get(n)??99;let c="hidden",x=0;const D=be.linger+.6;n._verdict==="miss"&&e>=n.t&&e<n.t+D?(c="miss",x=(e-n.t)/D,n.fired||(n.fired=!0,this._fire(n))):e>=n.t&&e<n.t+be.linger?(c="linger",x=(e-n.t)/be.linger,n.fired||(n.fired=!0,this._fire(n))):e>=n.t-a&&e<n.t?(c="countdown",x=(e-(n.t-a))/a):e<n.t-a&&(c=_<i?"preview":"locked"),this.layoutPreview&&n.surface!=="wall"&&(c="preview"),this.liveHideFloorMarks&&n.surface!=="wall"&&(c="hidden"),this.laneFX&&(this.laneFX.visible=!this.liveHideLane);const E=n.marker;if(E?.num&&n.surface!=="wall"&&n.foot){const C=!!P.hideOrderNums;C!==!!E._numFoot&&(E._numFoot=C,E.num.material.map=C?ha(n.foot==="right"):Ht(E._numN??""),E.num.material.needsUpdate=!0)}if(n.marker){if(n.surface==="wall"){const R=this._mapWall(n.srcToken);n.marker.group.position.set(R.x,R.y,R.z)}else{const R=this._mapFloor(n.srcToken);if(n.marker.group.position.set(R.x,.012,R.z),this.footprintTest&&c!=="hidden"&&!this.layoutPreview){const F=R.x+this.floorRoot.position.x,ee=R.z+this.floorRoot.position.z,Te=n.marker.radius*o*1.15;this.footprintTest(F,ee,Te)||(c="hidden");const te=c==="preview"||c==="countdown";if(te&&!n._wasVisible){const Re=this.gazeTest?this.gazeTest(F,ee):!0;this.stats.total++,Re&&this.stats.inGaze++}n._wasVisible=te}}c==="preview"&&_>=i&&!this.layoutPreview&&(c="hidden");const C=this.layoutPreview?0:Math.min(_,Ut.length-1);n.marker.strongPreview=this.layoutPreview,n.marker.render(c,x,C,o),n.stripes&&(n.stripes.visible=c==="countdown"||c==="linger")}if(n.arrow){const C=n.arrow;let R=this.layoutPreview||e>=C.t-a&&e<C.t+C.lifetime;if(R&&this.footprintTest&&!this.layoutPreview&&(R=this.footprintTest(C.obj.position.x+this.floorRoot.position.x,C.obj.position.z+this.floorRoot.position.z)),C.obj.visible=R,R){const ee=.35+.55*(this.layoutPreview?1:Math.min(1,(e-(C.t-a))/Math.max(a,.001)));C.obj._gain=ee,C.obj.scale.setScalar(o)}}}}fieldVisible(e){return this.root.visible&&(e==="wall"?this.wallRoot:this.floorRoot).visible}_fire(e){if(!this.fieldVisible(e.surface))return;const t=e.t<.15,a=e.marker?e.marker.group.getWorldPosition(new y):new y,o=e.surface==="wall"?new y(0,0,1):new y(0,1,0),i=e.srcToken?.design?.burst,s=i&&i.on?{...i}:{};e.surface==="wall"&&(s.sizeM=(e.marker?.radius??.15)*1.9,s.intensity=(s.intensity??1)*.8,s.speed=(s.speed??1)*1.35),e.surface!=="wall"&&this.layout?.mode==="advance"&&(s.forward=!0,a.z-=.18,s.intensity=(s.intensity??1)*1.7,s.rings=Math.max(s.rings??1,1.8)),t||this.effects.burst(a,e.color,o,s),this.onEvent&&this.onEvent(e)}studioBurst(e){if(!this.layout||!e)return;const t=this._mapFloor({nx:e.nx,ny:e.ny??0,t:e.t,foot:e.foot}),a=new y(t.x+this.floorRoot.position.x,.02,t.z+this.floorRoot.position.z),o=e.design?.burst,i=e.design?.fill?.c0||"#fa3030";this.effects.burst(a,i,new y(0,1,0),{...o&&o.on?o:{},noClip:!0})}}export{ba as B,oe as C,Rt as F,la as L,J as M,Ai as O,ya as T,Z as U,xe as W,Lt as a,da as b,Ct as c,ia as d,_a as e,be as f,wa as g,O as h,aa as m,xa as s,Sa as t};
