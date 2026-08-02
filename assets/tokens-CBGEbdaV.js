import{q as at,a as Te,b as Me,n as Ke,Q as oe,M as re,Z as Xe,t as nt,P as Ut,N as It,m as Ve}from"./fx-core-ClDF-mXh.js";import{aD as Ye,V as b,ap as _t,aE as mt,a7 as ne,aF as le,a3 as S,aG as Ze,ah as Qe,J as Fe,M as D,O as qe,$ as Ht,a0 as he,h as Q,aH as zt,av as Lt,aI as At,aJ as $e,aA as Je,v as lt,A as ht,a as wt,aK as ti,u as ei,aL as ii,aM as si,aN as ai,aO as oi,aP as ri,aQ as ni,aR as li,aS as hi,W as ui,aT as ci,S as pi,aU as fi,H as di,aV as mi,Q as ue,P as K,ab as Tt,aB as ce,x as j,af as pe,au as fe,aW as gi,X as de,aX as vi,ag as me,p as _i,C as B,R as ot,c as Z,b as Qt,aY as wi,i as Dt,k as Ce,Y as ge,aZ as ve,a_ as xi,F as R,N as qt,f as bi,ak as Re,G as tt,aj as yi,ai as Pi}from"./fxlut-DLo8BP_o.js";const _e={type:"change"},$t={type:"start"},Ee={type:"end"},Rt=new Ze,we=new Qe,Si=Math.cos(70*Fe.DEG2RAD),L=new b,z=2*Math.PI,P={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Xt=1e-6;class Ti extends Ye{constructor(t,e=null){super(t,e),this.state=P.NONE,this.target=new b,this.cursor=new b,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:_t.ROTATE,MIDDLE:_t.DOLLY,RIGHT:_t.PAN},this.touches={ONE:mt.ROTATE,TWO:mt.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._domElementKeyEvents=null,this._lastPosition=new b,this._lastQuaternion=new ne,this._lastTargetPosition=new b,this._quat=new ne().setFromUnitVectors(t.up,new b(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new le,this._sphericalDelta=new le,this._scale=1,this._panOffset=new b,this._rotateStart=new S,this._rotateEnd=new S,this._rotateDelta=new S,this._panStart=new S,this._panEnd=new S,this._panDelta=new S,this._dollyStart=new S,this._dollyEnd=new S,this._dollyDelta=new S,this._dollyDirection=new b,this._mouse=new S,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=Fi.bind(this),this._onPointerDown=Mi.bind(this),this._onPointerUp=Ci.bind(this),this._onContextMenu=Ni.bind(this),this._onMouseWheel=Li.bind(this),this._onKeyDown=Ai.bind(this),this._onTouchStart=Di.bind(this),this._onTouchMove=Oi.bind(this),this._onMouseDown=Ri.bind(this),this._onMouseMove=Ei.bind(this),this._interceptControlDown=ki.bind(this),this._interceptControlUp=Ui.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}connect(t){super.connect(t),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(t){t.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=t}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(_e),this.update(),this.state=P.NONE}update(t=null){const e=this.object.position;L.copy(e).sub(this.target),L.applyQuaternion(this._quat),this._spherical.setFromVector3(L),this.autoRotate&&this.state===P.NONE&&this._rotateLeft(this._getAutoRotationAngle(t)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let i=this.minAzimuthAngle,o=this.maxAzimuthAngle;isFinite(i)&&isFinite(o)&&(i<-Math.PI?i+=z:i>Math.PI&&(i-=z),o<-Math.PI?o+=z:o>Math.PI&&(o-=z),i<=o?this._spherical.theta=Math.max(i,Math.min(o,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(i+o)/2?Math.max(i,this._spherical.theta):Math.min(o,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let a=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{const s=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),a=s!=this._spherical.radius}if(L.setFromSpherical(this._spherical),L.applyQuaternion(this._quatInverse),e.copy(this.target).add(L),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let s=null;if(this.object.isPerspectiveCamera){const l=L.length();s=this._clampDistance(l*this._scale);const h=l-s;this.object.position.addScaledVector(this._dollyDirection,h),this.object.updateMatrixWorld(),a=!!h}else if(this.object.isOrthographicCamera){const l=new b(this._mouse.x,this._mouse.y,0);l.unproject(this.object);const h=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),a=h!==this.object.zoom;const p=new b(this._mouse.x,this._mouse.y,0);p.unproject(this.object),this.object.position.sub(p).add(l),this.object.updateMatrixWorld(),s=L.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;s!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(s).add(this.object.position):(Rt.origin.copy(this.object.position),Rt.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(Rt.direction))<Si?this.object.lookAt(this.target):(we.setFromNormalAndCoplanarPoint(this.object.up,this.target),Rt.intersectPlane(we,this.target))))}else if(this.object.isOrthographicCamera){const s=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),s!==this.object.zoom&&(this.object.updateProjectionMatrix(),a=!0)}return this._scale=1,this._performCursorZoom=!1,a||this._lastPosition.distanceToSquared(this.object.position)>Xt||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Xt||this._lastTargetPosition.distanceToSquared(this.target)>Xt?(this.dispatchEvent(_e),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(t){return t!==null?z/60*this.autoRotateSpeed*t:z/60/60*this.autoRotateSpeed}_getZoomScale(t){const e=Math.abs(t*.01);return Math.pow(.95,this.zoomSpeed*e)}_rotateLeft(t){this._sphericalDelta.theta-=t}_rotateUp(t){this._sphericalDelta.phi-=t}_panLeft(t,e){L.setFromMatrixColumn(e,0),L.multiplyScalar(-t),this._panOffset.add(L)}_panUp(t,e){this.screenSpacePanning===!0?L.setFromMatrixColumn(e,1):(L.setFromMatrixColumn(e,0),L.crossVectors(this.object.up,L)),L.multiplyScalar(t),this._panOffset.add(L)}_pan(t,e){const i=this.domElement;if(this.object.isPerspectiveCamera){const o=this.object.position;L.copy(o).sub(this.target);let a=L.length();a*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*t*a/i.clientHeight,this.object.matrix),this._panUp(2*e*a/i.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(t*(this.object.right-this.object.left)/this.object.zoom/i.clientWidth,this.object.matrix),this._panUp(e*(this.object.top-this.object.bottom)/this.object.zoom/i.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(t){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=t:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(t){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=t:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(t,e){if(!this.zoomToCursor)return;this._performCursorZoom=!0;const i=this.domElement.getBoundingClientRect(),o=t-i.left,a=e-i.top,s=i.width,l=i.height;this._mouse.x=o/s*2-1,this._mouse.y=-(a/l)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(t){return Math.max(this.minDistance,Math.min(this.maxDistance,t))}_handleMouseDownRotate(t){this._rotateStart.set(t.clientX,t.clientY)}_handleMouseDownDolly(t){this._updateZoomParameters(t.clientX,t.clientX),this._dollyStart.set(t.clientX,t.clientY)}_handleMouseDownPan(t){this._panStart.set(t.clientX,t.clientY)}_handleMouseMoveRotate(t){this._rotateEnd.set(t.clientX,t.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const e=this.domElement;this._rotateLeft(z*this._rotateDelta.x/e.clientHeight),this._rotateUp(z*this._rotateDelta.y/e.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(t){this._dollyEnd.set(t.clientX,t.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(t){this._panEnd.set(t.clientX,t.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(t){this._updateZoomParameters(t.clientX,t.clientY),t.deltaY<0?this._dollyIn(this._getZoomScale(t.deltaY)):t.deltaY>0&&this._dollyOut(this._getZoomScale(t.deltaY)),this.update()}_handleKeyDown(t){let e=!1;switch(t.code){case this.keys.UP:t.ctrlKey||t.metaKey||t.shiftKey?this.enableRotate&&this._rotateUp(z*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),e=!0;break;case this.keys.BOTTOM:t.ctrlKey||t.metaKey||t.shiftKey?this.enableRotate&&this._rotateUp(-z*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),e=!0;break;case this.keys.LEFT:t.ctrlKey||t.metaKey||t.shiftKey?this.enableRotate&&this._rotateLeft(z*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),e=!0;break;case this.keys.RIGHT:t.ctrlKey||t.metaKey||t.shiftKey?this.enableRotate&&this._rotateLeft(-z*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),e=!0;break}e&&(t.preventDefault(),this.update())}_handleTouchStartRotate(t){if(this._pointers.length===1)this._rotateStart.set(t.pageX,t.pageY);else{const e=this._getSecondPointerPosition(t),i=.5*(t.pageX+e.x),o=.5*(t.pageY+e.y);this._rotateStart.set(i,o)}}_handleTouchStartPan(t){if(this._pointers.length===1)this._panStart.set(t.pageX,t.pageY);else{const e=this._getSecondPointerPosition(t),i=.5*(t.pageX+e.x),o=.5*(t.pageY+e.y);this._panStart.set(i,o)}}_handleTouchStartDolly(t){const e=this._getSecondPointerPosition(t),i=t.pageX-e.x,o=t.pageY-e.y,a=Math.sqrt(i*i+o*o);this._dollyStart.set(0,a)}_handleTouchStartDollyPan(t){this.enableZoom&&this._handleTouchStartDolly(t),this.enablePan&&this._handleTouchStartPan(t)}_handleTouchStartDollyRotate(t){this.enableZoom&&this._handleTouchStartDolly(t),this.enableRotate&&this._handleTouchStartRotate(t)}_handleTouchMoveRotate(t){if(this._pointers.length==1)this._rotateEnd.set(t.pageX,t.pageY);else{const i=this._getSecondPointerPosition(t),o=.5*(t.pageX+i.x),a=.5*(t.pageY+i.y);this._rotateEnd.set(o,a)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const e=this.domElement;this._rotateLeft(z*this._rotateDelta.x/e.clientHeight),this._rotateUp(z*this._rotateDelta.y/e.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(t){if(this._pointers.length===1)this._panEnd.set(t.pageX,t.pageY);else{const e=this._getSecondPointerPosition(t),i=.5*(t.pageX+e.x),o=.5*(t.pageY+e.y);this._panEnd.set(i,o)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(t){const e=this._getSecondPointerPosition(t),i=t.pageX-e.x,o=t.pageY-e.y,a=Math.sqrt(i*i+o*o);this._dollyEnd.set(0,a),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);const s=(t.pageX+e.x)*.5,l=(t.pageY+e.y)*.5;this._updateZoomParameters(s,l)}_handleTouchMoveDollyPan(t){this.enableZoom&&this._handleTouchMoveDolly(t),this.enablePan&&this._handleTouchMovePan(t)}_handleTouchMoveDollyRotate(t){this.enableZoom&&this._handleTouchMoveDolly(t),this.enableRotate&&this._handleTouchMoveRotate(t)}_addPointer(t){this._pointers.push(t.pointerId)}_removePointer(t){delete this._pointerPositions[t.pointerId];for(let e=0;e<this._pointers.length;e++)if(this._pointers[e]==t.pointerId){this._pointers.splice(e,1);return}}_isTrackingPointer(t){for(let e=0;e<this._pointers.length;e++)if(this._pointers[e]==t.pointerId)return!0;return!1}_trackPointer(t){let e=this._pointerPositions[t.pointerId];e===void 0&&(e=new S,this._pointerPositions[t.pointerId]=e),e.set(t.pageX,t.pageY)}_getSecondPointerPosition(t){const e=t.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[e]}_customWheelEvent(t){const e=t.deltaMode,i={clientX:t.clientX,clientY:t.clientY,deltaY:t.deltaY};switch(e){case 1:i.deltaY*=16;break;case 2:i.deltaY*=100;break}return t.ctrlKey&&!this._controlActive&&(i.deltaY*=10),i}}function Mi(n){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(n.pointerId),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(n)&&(this._addPointer(n),n.pointerType==="touch"?this._onTouchStart(n):this._onMouseDown(n)))}function Fi(n){this.enabled!==!1&&(n.pointerType==="touch"?this._onTouchMove(n):this._onMouseMove(n))}function Ci(n){switch(this._removePointer(n),this._pointers.length){case 0:this.domElement.releasePointerCapture(n.pointerId),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(Ee),this.state=P.NONE;break;case 1:const t=this._pointers[0],e=this._pointerPositions[t];this._onTouchStart({pointerId:t,pageX:e.x,pageY:e.y});break}}function Ri(n){let t;switch(n.button){case 0:t=this.mouseButtons.LEFT;break;case 1:t=this.mouseButtons.MIDDLE;break;case 2:t=this.mouseButtons.RIGHT;break;default:t=-1}switch(t){case _t.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(n),this.state=P.DOLLY;break;case _t.ROTATE:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=P.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=P.ROTATE}break;case _t.PAN:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=P.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=P.PAN}break;default:this.state=P.NONE}this.state!==P.NONE&&this.dispatchEvent($t)}function Ei(n){switch(this.state){case P.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(n);break;case P.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(n);break;case P.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(n);break}}function Li(n){this.enabled===!1||this.enableZoom===!1||this.state!==P.NONE||(n.preventDefault(),this.dispatchEvent($t),this._handleMouseWheel(this._customWheelEvent(n)),this.dispatchEvent(Ee))}function Ai(n){this.enabled!==!1&&this._handleKeyDown(n)}function Di(n){switch(this._trackPointer(n),this._pointers.length){case 1:switch(this.touches.ONE){case mt.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(n),this.state=P.TOUCH_ROTATE;break;case mt.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(n),this.state=P.TOUCH_PAN;break;default:this.state=P.NONE}break;case 2:switch(this.touches.TWO){case mt.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(n),this.state=P.TOUCH_DOLLY_PAN;break;case mt.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(n),this.state=P.TOUCH_DOLLY_ROTATE;break;default:this.state=P.NONE}break;default:this.state=P.NONE}this.state!==P.NONE&&this.dispatchEvent($t)}function Oi(n){switch(this._trackPointer(n),this.state){case P.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(n),this.update();break;case P.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(n),this.update();break;case P.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(n),this.update();break;case P.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(n),this.update();break;default:this.state=P.NONE}}function Ni(n){this.enabled!==!1&&n.preventDefault()}function ki(n){n.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function Ui(n){n.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}const Ot={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

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


		}`};class bt{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}const Ii=new qe(-1,1,1,-1,0,1);class Hi extends Ht{constructor(){super(),this.setAttribute("position",new he([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new he([0,2,0,0,2,0],2))}}const zi=new Hi;class Jt{constructor(t){this._mesh=new D(zi,t)}dispose(){this._mesh.geometry.dispose()}render(t){t.render(this._mesh,Ii)}get material(){return this._mesh.material}set material(t){this._mesh.material=t}}class Nt extends bt{constructor(t,e="tDiffuse"){super(),this.textureID=e,this.uniforms=null,this.material=null,t instanceof Q?(this.uniforms=t.uniforms,this.material=t):t&&(this.uniforms=zt.clone(t.uniforms),this.material=new Q({name:t.name!==void 0?t.name:"unspecified",defines:Object.assign({},t.defines),uniforms:this.uniforms,vertexShader:t.vertexShader,fragmentShader:t.fragmentShader})),this._fsQuad=new Jt(this.material)}render(t,e,i){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=i.texture),this._fsQuad.material=this.material,this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(e),this.clear&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),this._fsQuad.render(t))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class xe extends bt{constructor(t,e){super(),this.scene=t,this.camera=e,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(t,e,i){const o=t.getContext(),a=t.state;a.buffers.color.setMask(!1),a.buffers.depth.setMask(!1),a.buffers.color.setLocked(!0),a.buffers.depth.setLocked(!0);let s,l;this.inverse?(s=0,l=1):(s=1,l=0),a.buffers.stencil.setTest(!0),a.buffers.stencil.setOp(o.REPLACE,o.REPLACE,o.REPLACE),a.buffers.stencil.setFunc(o.ALWAYS,s,4294967295),a.buffers.stencil.setClear(l),a.buffers.stencil.setLocked(!0),t.setRenderTarget(i),this.clear&&t.clear(),t.render(this.scene,this.camera),t.setRenderTarget(e),this.clear&&t.clear(),t.render(this.scene,this.camera),a.buffers.color.setLocked(!1),a.buffers.depth.setLocked(!1),a.buffers.color.setMask(!0),a.buffers.depth.setMask(!0),a.buffers.stencil.setLocked(!1),a.buffers.stencil.setFunc(o.EQUAL,1,4294967295),a.buffers.stencil.setOp(o.KEEP,o.KEEP,o.KEEP),a.buffers.stencil.setLocked(!0)}}class Wi extends bt{constructor(){super(),this.needsSwap=!1}render(t){t.state.buffers.stencil.setLocked(!1),t.state.buffers.stencil.setTest(!1)}}class be{constructor(t,e){if(this.renderer=t,this._pixelRatio=t.getPixelRatio(),e===void 0){const i=t.getSize(new S);this._width=i.width,this._height=i.height,e=new Lt(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:At}),e.texture.name="EffectComposer.rt1"}else this._width=e.width,this._height=e.height;this.renderTarget1=e,this.renderTarget2=e.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Nt(Ot),this.copyPass.material.blending=$e,this.clock=new Je}swapBuffers(){const t=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=t}addPass(t){this.passes.push(t),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(t,e){this.passes.splice(e,0,t),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(t){const e=this.passes.indexOf(t);e!==-1&&this.passes.splice(e,1)}isLastEnabledPass(t){for(let e=t+1;e<this.passes.length;e++)if(this.passes[e].enabled)return!1;return!0}render(t){t===void 0&&(t=this.clock.getDelta());const e=this.renderer.getRenderTarget();let i=!1;for(let o=0,a=this.passes.length;o<a;o++){const s=this.passes[o];if(s.enabled!==!1){if(s.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(o),s.render(this.renderer,this.writeBuffer,this.readBuffer,t,i),s.needsSwap){if(i){const l=this.renderer.getContext(),h=this.renderer.state.buffers.stencil;h.setFunc(l.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,t),h.setFunc(l.EQUAL,1,4294967295)}this.swapBuffers()}xe!==void 0&&(s instanceof xe?i=!0:s instanceof Wi&&(i=!1))}}this.renderer.setRenderTarget(e)}reset(t){if(t===void 0){const e=this.renderer.getSize(new S);this._pixelRatio=this.renderer.getPixelRatio(),this._width=e.width,this._height=e.height,t=this.renderTarget1.clone(),t.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=t,this.renderTarget2=t.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(t,e){this._width=t,this._height=e;const i=this._width*this._pixelRatio,o=this._height*this._pixelRatio;this.renderTarget1.setSize(i,o),this.renderTarget2.setSize(i,o);for(let a=0;a<this.passes.length;a++)this.passes[a].setSize(i,o)}setPixelRatio(t){this._pixelRatio=t,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class Gi extends bt{constructor(t,e,i=null,o=null,a=null){super(),this.scene=t,this.camera=e,this.overrideMaterial=i,this.clearColor=o,this.clearAlpha=a,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new lt}render(t,e,i){const o=t.autoClear;t.autoClear=!1;let a,s;this.overrideMaterial!==null&&(s=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(t.getClearColor(this._oldClearColor),t.setClearColor(this.clearColor,t.getClearAlpha())),this.clearAlpha!==null&&(a=t.getClearAlpha(),t.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&t.clearDepth(),t.setRenderTarget(this.renderToScreen?null:i),this.clear===!0&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),t.render(this.scene,this.camera),this.clearColor!==null&&t.setClearColor(this._oldClearColor),this.clearAlpha!==null&&t.setClearAlpha(a),this.overrideMaterial!==null&&(this.scene.overrideMaterial=s),t.autoClear=o}}const ji={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new lt(0)},defaultOpacity:{value:0}},vertexShader:`

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

		}`};class xt extends bt{constructor(t,e=1,i,o){super(),this.strength=e,this.radius=i,this.threshold=o,this.resolution=t!==void 0?new S(t.x,t.y):new S(256,256),this.clearColor=new lt(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let a=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);this.renderTargetBright=new Lt(a,s,{type:At}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let r=0;r<this.nMips;r++){const v=new Lt(a,s,{type:At});v.texture.name="UnrealBloomPass.h"+r,v.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(v);const u=new Lt(a,s,{type:At});u.texture.name="UnrealBloomPass.v"+r,u.texture.generateMipmaps=!1,this.renderTargetsVertical.push(u),a=Math.round(a/2),s=Math.round(s/2)}const l=ji;this.highPassUniforms=zt.clone(l.uniforms),this.highPassUniforms.luminosityThreshold.value=o,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new Q({uniforms:this.highPassUniforms,vertexShader:l.vertexShader,fragmentShader:l.fragmentShader}),this.separableBlurMaterials=[];const h=[3,5,7,9,11];a=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);for(let r=0;r<this.nMips;r++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(h[r])),this.separableBlurMaterials[r].uniforms.invSize.value=new S(1/a,1/s),a=Math.round(a/2),s=Math.round(s/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=e,this.compositeMaterial.uniforms.bloomRadius.value=.1;const p=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=p,this.bloomTintColors=[new b(1,1,1),new b(1,1,1),new b(1,1,1),new b(1,1,1),new b(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=zt.clone(Ot.uniforms),this.blendMaterial=new Q({uniforms:this.copyUniforms,vertexShader:Ot.vertexShader,fragmentShader:Ot.fragmentShader,blending:ht,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new lt,this._oldClearAlpha=1,this._basic=new wt,this._fsQuad=new Jt(null)}dispose(){for(let t=0;t<this.renderTargetsHorizontal.length;t++)this.renderTargetsHorizontal[t].dispose();for(let t=0;t<this.renderTargetsVertical.length;t++)this.renderTargetsVertical[t].dispose();this.renderTargetBright.dispose();for(let t=0;t<this.separableBlurMaterials.length;t++)this.separableBlurMaterials[t].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(t,e){let i=Math.round(t/2),o=Math.round(e/2);this.renderTargetBright.setSize(i,o);for(let a=0;a<this.nMips;a++)this.renderTargetsHorizontal[a].setSize(i,o),this.renderTargetsVertical[a].setSize(i,o),this.separableBlurMaterials[a].uniforms.invSize.value=new S(1/i,1/o),i=Math.round(i/2),o=Math.round(o/2)}render(t,e,i,o,a){t.getClearColor(this._oldClearColor),this._oldClearAlpha=t.getClearAlpha();const s=t.autoClear;t.autoClear=!1,t.setClearColor(this.clearColor,0),a&&t.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=i.texture,t.setRenderTarget(null),t.clear(),this._fsQuad.render(t)),this.highPassUniforms.tDiffuse.value=i.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,t.setRenderTarget(this.renderTargetBright),t.clear(),this._fsQuad.render(t);let l=this.renderTargetBright;for(let h=0;h<this.nMips;h++)this._fsQuad.material=this.separableBlurMaterials[h],this.separableBlurMaterials[h].uniforms.colorTexture.value=l.texture,this.separableBlurMaterials[h].uniforms.direction.value=xt.BlurDirectionX,t.setRenderTarget(this.renderTargetsHorizontal[h]),t.clear(),this._fsQuad.render(t),this.separableBlurMaterials[h].uniforms.colorTexture.value=this.renderTargetsHorizontal[h].texture,this.separableBlurMaterials[h].uniforms.direction.value=xt.BlurDirectionY,t.setRenderTarget(this.renderTargetsVertical[h]),t.clear(),this._fsQuad.render(t),l=this.renderTargetsVertical[h];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,t.setRenderTarget(this.renderTargetsHorizontal[0]),t.clear(),this._fsQuad.render(t),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,a&&t.state.buffers.stencil.setTest(!0),this.renderToScreen?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(i),this._fsQuad.render(t)),t.setClearColor(this._oldClearColor,this._oldClearAlpha),t.autoClear=s}_getSeparableBlurMaterial(t){const e=[];for(let i=0;i<t;i++)e.push(.39894*Math.exp(-.5*i*i/(t*t))/t);return new Q({defines:{KERNEL_RADIUS:t},uniforms:{colorTexture:{value:null},invSize:{value:new S(.5,.5)},direction:{value:new S(.5,.5)},gaussianCoefficients:{value:e}},vertexShader:`varying vec2 vUv;
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
				}`})}_getCompositeMaterial(t){return new Q({defines:{NUM_MIPS:t},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
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
				}`})}}xt.BlurDirectionX=new S(1,0);xt.BlurDirectionY=new S(0,1);const Et={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
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

		}`};class Bi extends bt{constructor(){super(),this.uniforms=zt.clone(Et.uniforms),this.material=new ti({name:Et.name,uniforms:this.uniforms,vertexShader:Et.vertexShader,fragmentShader:Et.fragmentShader}),this._fsQuad=new Jt(this.material),this._outputColorSpace=null,this._toneMapping=null}render(t,e,i){this.uniforms.tDiffuse.value=i.texture,this.uniforms.toneMappingExposure.value=t.toneMappingExposure,(this._outputColorSpace!==t.outputColorSpace||this._toneMapping!==t.toneMapping)&&(this._outputColorSpace=t.outputColorSpace,this._toneMapping=t.toneMapping,this.material.defines={},ei.getTransfer(this._outputColorSpace)===ii&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===si?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===ai?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===oi?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===ri?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===ni?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===li?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===hi&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(t.setRenderTarget(null),this._fsQuad.render(t)):(t.setRenderTarget(e),this.clear&&t.clear(t.autoClearColor,t.autoClearDepth,t.autoClearStencil),this._fsQuad.render(t))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}const N={bloomThreshold:.55,bloomStrength:.55,bloomRadius:.6,grain:0,vignette:.12,exposure:1,alphaOut:!1,alphaFloor:0},Ki={uniforms:{tDiffuse:{value:null},uGrain:{value:N.grain},uVignette:{value:N.vignette},uExposure:{value:N.exposure},uTime:{value:0},uAlphaOut:{value:0},uAlphaFloor:{value:0}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`
    uniform sampler2D tDiffuse;
    uniform float uGrain, uVignette, uExposure, uTime, uAlphaOut, uAlphaFloor;
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
        gl_FragColor = vec4(c.rgb, clamp(g * 1.8, 0.0, 1.0));
      } else gl_FragColor = c;
    }`},gt=-1.8;function qs(n){const t=new URLSearchParams(location.search).get("alpha")==="1",e=new ui({antialias:!0,alpha:t,premultipliedAlpha:!1});t&&e.setClearColor(0,0),e.setPixelRatio(Math.min(window.devicePixelRatio,2));const i=e.capabilities.getMaxAnisotropy();e.setSize(n.clientWidth,n.clientHeight),e.shadowMap.enabled=!0,e.shadowMap.type=ci,e.localClippingEnabled=!0,n.appendChild(e.domElement);const o=new pi;o.background=new lt(790034),o.fog=new fi(790034,9,20);const a=new di(50,n.clientWidth/n.clientHeight,.05,60),s=new Ti(a,e.domElement);s.enableDamping=!0,s.dampingFactor=.08,s.maxPolarAngle=Math.PI*.495,s.minDistance=1.2,s.maxDistance=14,o.add(new mi(3752527,1119258,1.1));const l=new ue(16777215,1.5);l.position.set(3,6,4),l.castShadow=!0,l.shadow.mapSize.set(2048,2048),l.shadow.camera.left=-5,l.shadow.camera.right=5,l.shadow.camera.top=5,l.shadow.camera.bottom=-5,o.add(l);const h=new ue(5227511,.35);h.position.set(-4,3,-3),o.add(h);const p=new D(new K(120,120),new Tt({color:1514016,roughness:.92,metalness:.05}));p.rotation.x=-Math.PI/2,p.receiveShadow=!0,o.add(p);const r=new ce(120,240,2304051,1777706);r.position.y=.002,o.add(r);const v=new j,u=new D(new K(5,3.2),new Tt({color:1843240,roughness:.95}));u.position.set(0,1.6,gt),u.receiveShadow=!0,v.add(u);const x=new ce(5,10,2765120,2304567);x.rotation.x=Math.PI/2,x.position.set(0,1.6,gt+.005),v.add(x),o.add(v);const k=(()=>{const c=new j,g=3.05,d=-7,f=.225,m=d-.15,_=new Tt({color:2830134,roughness:.6,metalness:.3}),w=new D(new pe(1.8,1.05,.03),new Tt({color:15594231,roughness:.25,metalness:.05,transparent:!0,opacity:.55}));w.position.set(0,g+.375,m-.015),w.castShadow=!0,c.add(w);const I=new fe(new gi(new pe(.59,.45,.001)),new de({color:15229482}));I.position.set(0,g+.19,m+.02),c.add(I);const A=new D(new vi(f,.014,10,28),new Tt({color:15229482,roughness:.4,metalness:.5}));A.rotation.x=Math.PI/2,A.position.set(0,g,d),A.castShadow=!0,c.add(A);const E=12,H=.4,W=.09,G=(O,je)=>Array.from({length:E},(Ys,Be)=>{const ae=Be/E*Math.PI*2;return new b(Math.cos(ae)*O,je,d+Math.sin(ae)*O)}),pt=G(f,g),ft=G((f+W)/2,g-H*.5),st=G(W,g-H),jt=[];for(let O=0;O<E;O++)jt.push(pt[O],ft[O],ft[O],st[O]);for(let O=0;O<E;O++)jt.push(ft[O],ft[(O+1)%E],st[O],st[(O+1)%E]);const Ge=new fe(new Ht().setFromPoints(jt),new de({color:16119280,transparent:!0,opacity:.75}));c.add(Ge);const Bt=new D(new me(.05,.06,w.position.y+.4,12),_);Bt.position.set(0,(w.position.y+.4)/2,m-.35),Bt.castShadow=!0,c.add(Bt);const Kt=new D(new me(.035,.035,.36,10),_);return Kt.rotation.x=Math.PI/2,Kt.position.set(0,w.position.y,m-.18),c.add(Kt),c.visible=!1,c.name="hoop",o.add(c),c})();let C=null;function M(){k.visible=C==="basketball"&&["court","court_tile","court_gray","court_black"].includes(Pt)}const F=new _i,T={},q="./";function yt(c,g,d){return new Promise(f=>{F.load(`${q}tex/${c}`,m=>{m.wrapS=m.wrapT=ot,m.repeat.set(g,d),m.anisotropy=i,m.colorSpace=Z,f(m)})})}async function $(c){if(T[c])return T[c];if(c==="grass")T.grass=await yt("grass.jpg",60,60);else if(c==="paving")T.paving=await yt("paving.jpg",50,50);else if(c==="plaster")T.plaster=await yt("plaster.jpg",2.5,1.6);else if(c==="court_tile"){const g=document.createElement("canvas");g.width=g.height=512;const d=g.getContext("2d"),f=128;d.fillStyle="#DCDEDF",d.fillRect(0,0,512,512);for(let _=0;_<4;_++)for(let w=0;w<4;w++){const I=w*f,A=_*f,E=(w*7+_*13)%5/5;d.fillStyle=`rgb(${214+E*10|0},${217+E*10|0},${219+E*10|0})`,d.fillRect(I,A,f,f),d.strokeStyle="rgba(150,156,161,0.5)",d.lineWidth=2,d.strokeRect(I+1,A+1,f-2,f-2),d.strokeStyle="rgba(156,163,169,0.62)",d.lineWidth=1.1;const H=f/4;for(let W=0;W<4;W++)for(let G=0;G<4;G++){const pt=I+W*H,ft=A+G*H;for(let st=0;st<2;st++)d.beginPath(),d.roundRect(pt+4+st*13,ft+5,11,H-10,3.5),d.stroke()}}const m=new B(g);m.wrapS=m.wrapT=ot,m.repeat.set(120,120),m.anisotropy=i,m.colorSpace=Z,T.court_tile=m}else if(c==="ivorywood"){const g=document.createElement("canvas");g.width=g.height=512;const d=g.getContext("2d"),f=(()=>{let w=11;return()=>(w=w*16807%2147483647)/2147483647})(),m=74;for(let w=0;w*m<512+m;w++){const I=w%2*190;for(let A=-1;A<3;A++){const E=A*380+I,H=w*m,W=.962+f()*.072;d.fillStyle=`rgb(${Math.min(255,238*W)|0}, ${Math.min(255,226*W)|0}, ${Math.min(255,212*W)|0})`,d.fillRect(E,H,380,m),d.strokeStyle="rgba(196,178,152,0.34)",d.lineWidth=1.4,d.strokeRect(E+.7,H+.7,380-1.4,m-1.4),d.strokeStyle="rgba(204,187,162,0.20)",d.lineWidth=1;for(let G=0;G<3;G++){const pt=H+12+f()*(m-24);d.beginPath(),d.moveTo(E+8,pt),d.lineTo(E+372,pt+(f()-.5)*5),d.stroke()}}}const _=new B(g);_.wrapS=_.wrapT=ot,_.repeat.set(46,46),_.anisotropy=i,_.colorSpace=Z,T.ivorywood=_}else if(c==="track"){const g=await new Promise(_=>{const w=new Image;w.onload=()=>_(w),w.src=`${q}tex/asphalt.jpg`}),d=document.createElement("canvas");d.width=d.height=512;const f=d.getContext("2d");f.fillStyle="#B7C6AA",f.fillRect(0,0,512,512),f.globalAlpha=.34,f.globalCompositeOperation="overlay",f.drawImage(g,0,0,512,512),f.globalAlpha=.12,f.globalCompositeOperation="saturation",f.fillStyle="#808080",f.fillRect(0,0,512,512),f.globalAlpha=1,f.globalCompositeOperation="source-over",f.fillStyle="rgba(248,248,244,0.85)",f.fillRect(96,0,7,512),f.fillRect(409,0,7,512);const m=new B(d);m.wrapS=m.wrapT=ot,m.repeat.set(60,60),m.anisotropy=i,m.colorSpace=Z,T.track=m}else if(c==="dirt"){const g=await new Promise(_=>{const w=new Image;w.onload=()=>_(w),w.src=`${q}tex/asphalt.jpg`}),d=document.createElement("canvas");d.width=d.height=512;const f=d.getContext("2d");f.fillStyle="#C4BBA4",f.fillRect(0,0,512,512),f.globalAlpha=.4,f.globalCompositeOperation="overlay",f.drawImage(g,0,0,512,512),f.globalAlpha=.16,f.globalCompositeOperation="saturation",f.fillStyle="#808080",f.fillRect(0,0,512,512),f.globalAlpha=1,f.globalCompositeOperation="source-over",f.strokeStyle="rgba(120,110,92,0.35)",f.lineWidth=2,f.beginPath(),f.moveTo(0,256),f.lineTo(512,262),f.moveTo(256,0),f.lineTo(250,512),f.stroke();const m=new B(d);m.wrapS=m.wrapT=ot,m.repeat.set(24,24),m.anisotropy=i,m.colorSpace=Z,T.dirt=m}else if(c==="indoorwood"){const g=document.createElement("canvas");g.width=g.height=512;const d=g.getContext("2d"),f=(()=>{let _=7;return()=>(_=_*16807%2147483647)/2147483647})();for(let _=0;_<8;_++){const w=_%2*128;for(let I=-1;I<3;I++){const A=I*256+w,E=_*64,H=.82+f()*.3;d.fillStyle=`rgb(${Math.round(168*H)}, ${Math.round(126*H)}, ${Math.round(84*H)})`,d.fillRect(A,E,256,64),d.strokeStyle="rgba(70,48,30,0.55)",d.lineWidth=2,d.strokeRect(A+1,E+1,254,62),d.strokeStyle="rgba(90,62,40,0.25)",d.lineWidth=1;for(let W=0;W<4;W++){const G=E+10+f()*46;d.beginPath(),d.moveTo(A+6,G),d.lineTo(A+250,G+(f()-.5)*6),d.stroke()}}}const m=new B(g);m.wrapS=m.wrapT=ot,m.repeat.set(26,26),m.anisotropy=i,m.colorSpace=Z,T.indoorwood=m}else if(c==="wallpaper"){const g=document.createElement("canvas");g.width=g.height=256;const d=g.getContext("2d");d.fillStyle="#F7F4EE",d.fillRect(0,0,256,256);const f=(()=>{let _=13;return()=>(_=_*16807%2147483647)/2147483647})();for(let _=0;_<256;_+=2){const w=.02+f()*.045;d.fillStyle=f()<.5?`rgba(210,202,188,${w})`:`rgba(255,255,255,${w})`,d.fillRect(_,0,1+f()*1.5,256)}for(let _=0;_<90;_++)d.fillStyle=`rgba(196,188,174,${.03+f()*.04})`,d.fillRect(f()*256,f()*256,1,3+f()*9);const m=new B(g);m.wrapS=m.wrapT=ot,m.repeat.set(9,5),m.anisotropy=i,m.colorSpace=Z,T.wallpaper=m}return T[c]}let Ft=0,Pt=null;function te(){return Pt==="indoor"?15723490:!Pt||Pt==="none"?8291727:12173514}function ee(){if(!U)return;const c=te();o.background.setHex(c),o.fog.color.setHex(c)}let X=null,V=null;async function Oe(c){const g=++Ft;if(Pt=!c||c==="none"?null:c,!c||c==="none"){p.material.map=null,p.material.color.setHex(U?6712438:1514016),u.material.map=null,u.material.color.setHex(U?7765126:1843240),u.material.emissive?.setHex(0),p.material.needsUpdate=!0,u.material.needsUpdate=!0,r.visible=!0,x.visible=!0,X&&(X.visible=!1),V&&(V.visible=!1),M(),ee();return}const d=c==="court_gray"||c==="court_black",f=c==="indoor"?"ivorywood":c==="court"?"indoorwood":c,[m,_]=await Promise.all([d?null:$(f),$("plaster")]);if(g===Ft){if(!X){const I=new Q({uniforms:{uColor:{value:new lt(16448245)},uOpacity:{value:.85},uHalf:{value:.025}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`
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
          }`,transparent:!0,depthWrite:!1});X=new D(new K(16,16),I),X.rotation.x=-Math.PI/2,X.position.y=.006,X.renderOrder=1,X.name="courtLines",o.add(X)}if(!V){const w=new Q({uniforms:{uTint:{value:new lt(11975358)},uOut:{value:.5},uKey:{value:.22}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`
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
          }`,transparent:!0,depthWrite:!1});V=new D(new K(60,60),w),V.rotation.x=-Math.PI/2,V.position.y=.005,V.renderOrder=0,V.name="courtZones",o.add(V)}if(V.visible=c==="court_tile",X.visible=c==="court"||c==="court_tile"||d,p.material.map=d?null:m,u.material.map=_,d)p.material.color.setHex(c==="court_black"?2502721:2830912),p.material.roughness=c==="court_black"?.42:.6,p.material.metalness=c==="court_black"?.22:.12,u.material.map=await $("wallpaper"),u.material.color.setHex(16777215),u.material.emissive?.setHex(U?7236195:5722955);else if(c==="court_tile"||c==="track"){const w=c==="court_tile";p.material.roughness=w?.78:.92,p.material.metalness=w?.04:.05,p.material.color.setHex(U?14474975:12567753),u.material.map=await $("wallpaper"),u.material.color.setHex(16777215),u.material.emissive?.setHex(U?7236195:5722955)}else c==="indoor"||c==="court"?(p.material.roughness=.92,p.material.metalness=.05,p.material.color.setHex(c==="indoor"?U?16249577:14209218:U?16183784:14209218),u.material.map=await $("wallpaper"),u.material.color.setHex(16777215),u.material.emissive?.setHex(U?7236195:5722955)):(u.material.emissive?.setHex(0),p.material.roughness=.92,p.material.metalness=.05,p.material.color.setHex(U?14408667:9079434),u.material.color.setHex(U?14869218:10132122));p.material.needsUpdate=!0,u.material.needsUpdate=!0,r.visible=!1,x.visible=!1,M(),ee()}}const ie={running:{pos:[2.9,2.1,2.9],look:[0,.7,-.6]},boxing:{pos:[3.5,1.9,3.9],look:[0,1.1,-.1]},basketball:{pos:[3.4,2.6,2.6],look:[0,.6,-1]}};function Ne(c){const g=ie[c]||ie.running;a.position.set(...g.pos),s.target.set(...g.look),s.update()}function ke(c,g){v.visible=!!g,C=c,M(),Ne(c)}const ut=o.children.find(c=>c.isHemisphereLight);let U=!1;function Ue(c){if(U=!!c,N.day=U,U){const g=te();o.background.setHex(g),o.fog.color.setHex(g),o.fog.near=14,o.fog.far=40,ut.color.setHex(14476526),ut.groundColor.setHex(8291468),ut.intensity=1.1,l.intensity=1.6,l.color.setHex(16774112),h.intensity=.12,p.material.map||p.material.color.setHex(6712438),u.material.map||u.material.color.setHex(7765126),p.material.map&&p.material.color.setHex(14408667),u.material.map&&u.material.color.setHex(14869218)}else o.background.setHex(790034),o.fog.color.setHex(790034),o.fog.near=9,o.fog.far=20,ut.color.setHex(3752527),ut.groundColor.setHex(1119258),ut.intensity=1.1,l.intensity=1.5,l.color.setHex(16777215),h.intensity=.35,p.material.map||p.material.color.setHex(1514016),u.material.map||u.material.color.setHex(1843240),p.material.map&&p.material.color.setHex(9079434),u.material.map&&u.material.color.setHex(10132122);p.material.needsUpdate=!0,u.material.needsUpdate=!0}const J=new be(e),Gt=new Gi(o,a);J.addPass(Gt),J.addPass(new Nt({uniforms:{tDiffuse:{value:null}},vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);if(c.r!=c.r||c.g!=c.g||c.b!=c.b||c.a!=c.a)c=vec4(0.0);gl_FragColor=clamp(c,0.0,60.0);}"}));const St=new xt(new S(n.clientWidth/2,n.clientHeight/2),N.bloomStrength,N.bloomRadius,N.bloomThreshold);J.addPass(St),J.renderToScreen=!1;const ct=new be(e);ct.addPass(Gt),ct.addPass(new Nt({uniforms:{tDiffuse:{value:null},tBloom:{value:J.renderTarget2.texture}},vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"uniform sampler2D tDiffuse,tBloom;varying vec2 vUv;void main(){gl_FragColor=texture2D(tDiffuse,vUv)+texture2D(tBloom,vUv);}"}));const it=new Nt(Ki);ct.addPass(it),ct.addPass(new Bi);const Ct=[];function Ie(){Ct.length=0,o.traverse(c=>{c.visible&&c.material?._noBloom&&(c.visible=!1,Ct.push(c))})}function He(){for(const c of Ct)c.visible=!0;Ct.length=0}function ze(c){St.threshold=N.bloomThreshold+(N.day?.38:0),St.strength=N.bloomStrength,St.radius=N.bloomRadius,it.uniforms.uGrain.value=N.grain,it.uniforms.uVignette.value=N.vignette,it.uniforms.uExposure.value=N.exposure,it.uniforms.uTime.value=c,it.uniforms.uAlphaOut.value=N.alphaOut?1:0,it.uniforms.uAlphaFloor.value=N.alphaFloor||0,Ie(),J.render(),He(),ct.render()}function se(){e.domElement.style.width="0px",e.domElement.style.height="0px";const c=n.clientWidth,g=n.clientHeight;a.aspect=c/g,a.updateProjectionMatrix(),e.setSize(c,g),J.setSize(c,g),ct.setSize(c,g),St.setSize(c/2,g/2)}window.addEventListener("resize",se);function We(c){const g=Math.round(c/2)*2;p.position.z=g,r.position.z=g}return{renderer:e,scene:o,camera:a,controls:s,setPackEnvironment:ke,resize:se,renderFrame:ze,composer:J,setSurfaces:Oe,setDaylight:Ue,followFloor:We,wall:u,wallGroup:v,hoop:k,setRenderCamera:c=>{Gt.camera=c}}}const Xi="MARK(발형·존원) 룩 정본. footlab.html '코드에 저장'이 이 파일을 덮어쓴다.",Vi=.98,Yi=.83,Zi=-.043,Qi=-.031,qi=5.5,$i=.027,Ji=.25,ts=.26,es=.3,is=.74,ss=.038,as=.84,os=24,rs=1,ns=1.6,ls=.45,hs=.82,us=0,cs=.5,ps=.5,fs=.125,ds=.4,ms=1,gs=.34,vs=0,_s=3.4,ws=.01,xs=0,bs=.011,ys=-2,Ps=.8,Ss=-.085,Ts=.16,Ms=4,Fs=.6,Cs=1,Rs=1,Es="glow",Ls="add",As="offbit",Ds=.55,Os=.125,Ns=0,y={_:Xi,imp:Vi,scale:Yi,offx:Zi,offy:Qi,irot:qi,pitch:$i,dot:Ji,glow:ts,shade:es,sharp:is,edge:ss,plantar:as,bands:os,bandSoft:rs,w:ns,halo:ls,pool:hs,noise:us,rip:cs,ripReach:ps,ripWidth:fs,ripSpeed:ds,ripGrad:ms,edgeShade:gs,shadeRed:vs,shadeRedW:_s,edgeW:ws,edgeSoft:xs,dither:bs,tilt:ys,gsize:Ps,gx:Ss,gy:Ts,grot:Ms,gsh:Fs,shadeCol:Cs,ripCol:Rs,gShadow:Es,gBlend:Ls,numSrc:As,prog:Ds,bloom:Os,blur:Ns},Le=`
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
}`,ks=`
uniform float uHT, uHTPitch, uHTGain, uHTSoft, uHTWave, uHTGlow, uHTInner;
uniform sampler2D uNumTex; uniform float uNumOn, uNumScale; uniform vec2 uNumOff;   // 하프톤 스킨 — 후보랩 확정본
#include <common>
#include <clipping_planes_pars_fragment>
`+Ce+`
uniform float uW, uHalo, uNoise;
`+Ke+`
uniform float uPhase, uProg, uFade, uStrong, uTime, uGain, uDay, uOut, uToe;
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
}`,Us=`
#include <common>
#include <clipping_planes_pars_fragment>
`+Ce+`
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
}`,Is={solid:0,dash:1,dot:2,chevron:3,comet:4,taper:5},Y={ox:0,oz:0,fx:0,fz:-1,rx:1,rz:0,halfL:0,halfW:0,feather:.3,amt:0};function Hs(n){const t=new Q({vertexShader:Le,fragmentShader:Us,uniforms:{uLUT:{value:Dt()},uTime:{value:0},uLen:{value:n},uW:{value:1},uHalo:{value:.9},uGain:{value:1},uLStyle:{value:1},uLSpeed:{value:1},uLGap:{value:1},uLHeat:{value:.5},uLTail:{value:.55},uDay:{value:0},uOut:{value:1},uFPOrigin:{value:new b},uFPFwd:{value:new b(0,0,-1)},uFPRight:{value:new b(1,0,0)},uFPNear:{value:-1e6},uFPFar:{value:1e6},uFPHalfN:{value:1e6},uFPHalfF:{value:1e6},uFPFadeM:{value:.15}},transparent:!0,blending:ht,depthWrite:!1,side:Qt});return t.clipping=!0,t._src="LANEFX",t}const rt=Te/Me,Mt={core:y.w,halo:y.halo,pool:y.pool,sweep:.4,wobble:y.noise};function zs(n=null){const t=new Q({vertexShader:Le,fragmentShader:ks,uniforms:{uLUT:{value:Dt()},uUIOrigin:{value:new b},uUIFwd:{value:new b(0,0,-1)},uUIRight:{value:new b(1,0,0)},uUIHalfL:{value:0},uUIHalfW:{value:0},uUIFeather:{value:.3},uUIAmt:{value:0},uShape:{value:n?1:0},uRadius:{value:n?1:1.5652173913043477},uSDF2:{value:n||Dt()},uSDFWarn:{value:wi()||Dt()},uImp:{value:n?y.imp:0},uImpPitch:{value:y.pitch*rt},uImpDot:{value:y.dot},uImpGlow:{value:y.glow},uImpShade:{value:y.shade},uImpSharp:{value:y.sharp},uImpShadeCol:{value:y.shadeCol},uImpEdge:{value:y.edge*rt},uImpScale:{value:y.scale},uImpRot:{value:(n?._right?-5.5:y.irot)*Math.PI/180},uImpCtr:{value:new S(n?(n._inCx??.5)*2-1:0,n?1-(n._inCy??.5)*2:0)},uImpOff:{value:new S((n?._right?.043:y.offx)*rt,y.offy*rt)},uRip:{value:y.rip},uRipSpeed:{value:y.ripSpeed},uRipWidth:{value:y.ripWidth*rt},uRipReach:{value:y.ripReach*rt},uEdgeShade:{value:y.edgeShade},uEdgeW:{value:y.edgeW*rt},uEdgeSoft:{value:y.edgeSoft},uShadeRed:{value:y.shadeRed},uShadeRedW:{value:y.shadeRedW},uDither:{value:y.dither},uSilFit:{value:Te/Me},uPlantar:{value:y.plantar},uBands:{value:y.bands},uBandSoft:{value:y.bandSoft},uRipGrad:{value:y.ripGrad},uRipCol:{value:y.ripCol},uPhase:{value:0},uProg:{value:0},uFade:{value:1},uToe:{value:0},uStrong:{value:0},uContract:{value:0},uTime:{value:0},uSeed:{value:Math.random()*6.2832},uW:{value:1},uHalo:{value:.9},uPool:{value:.55},uGain:{value:1},uSweepA:{value:1},uNoise:{value:.5},uDay:{value:0},uOut:{value:1},uHT:{value:0},uHTPitch:{value:.055},uHTGain:{value:1.15},uHTSoft:{value:.55},uHTWave:{value:.6},uHTGlow:{value:0},uHTInner:{value:0},uNumTex:{value:null},uNumOn:{value:0},uNumScale:{value:.311},uNumOff:{value:new S},uFPOrigin:{value:new b},uFPFwd:{value:new b(0,0,-1)},uFPRight:{value:new b(1,0,0)},uFPNear:{value:-1e6},uFPFar:{value:1e6},uFPHalfN:{value:1e6},uFPHalfF:{value:1e6},uFPFadeM:{value:.28}},transparent:!0,blending:ht,depthWrite:!1,side:Qt});return t.clipping=!0,t._src=n?"MARKFX(발형)":"MARKFX(존원)",t._noBloom=!0,t}const et={left:at.red,right:at.red,target:at.red,guide:at.coral,lane:at.red,success:at.prism,user:at.prism},Ae=[1,.75,.55,.38],Ws=[1,.78,.58,.42];let Wt=!1;function $s(n){Wt=!!n}const Zt=.26,Gs=.727,ye=Zt/Gs,Vt={base:Zt*.75,loose:Zt*1},vt={markScale:1,fillOpacity:.2,previewEdge:.5,cdContractFrom:1.9,cdGain:.6,lingerEdge:.9,linger:.35};vt.linger;const js={running:{mode:"advance",V:2.5,STRIKE_AHEAD:.15,X_SCALE:2,LANE_W:1.6,CAL:{right:{x:-.187,z:.049},left:{x:.128,z:0}}},boxing:{mode:"static",FLOOR_SCALE:1.6,WALL:{XS:2.2,Y0:.73,YS:1.2}},basketball:{mode:"spatial",SCALE:5}},Js=5,Yt={},dt=new Image;dt.src="./ready-view/assets/pace_foot.svg";function Bs(n){const t=n?"R":"L";if(Yt[t])return Yt[t];const e=document.createElement("canvas");e.width=e.height=128;const i=e.getContext("2d"),o=dt.complete&&dt.naturalWidth;if(o){const s=document.createElement("canvas");s.width=s.height=128;const l=s.getContext("2d"),h=dt.naturalWidth/dt.naturalHeight,p=100,r=p/h;l.save(),n&&(l.translate(128,0),l.scale(-1,1)),l.drawImage(dt,(128-p)/2,(128-r)/2,p,r),l.restore(),l.globalCompositeOperation="source-in",l.fillStyle=nt(It.ink,.95),l.fillRect(0,0,128,128),i.shadowColor=nt(Ut.coral,.75),i.shadowBlur=12,i.drawImage(s,0,0),i.shadowBlur=0,i.drawImage(s,0,0)}else i.strokeStyle=nt(It.ink,.95),i.lineWidth=5,i.shadowColor=nt(Ut.coral,.75),i.shadowBlur=12,i.beginPath(),i.ellipse(64,64,20,34,n?.12:-.12,0,Math.PI*2),i.stroke();const a=new B(e);return a.colorSpace=Z,a.anisotropy=4,o&&(Yt[t]=a),a}function De(n){const t=document.createElement("canvas");t.width=t.height=128;const e=t.getContext("2d");Re(e,String(n),64,64,96)||(e.fillStyle=nt(It.ink,.95),e.font="300 86px -apple-system, sans-serif",e.textAlign="center",e.textBaseline="middle",e.shadowColor=nt(Ut.coral,.75),e.shadowBlur=14,e.fillText(String(n),64,70));const i=new B(t);return i.anisotropy=4,i}function Ks(n){const i=document.createElement("canvas");i.width=4,i.height=4;let o=i.getContext("2d");o.font="400 56px -apple-system, 'Apple SD Gothic Neo', sans-serif";const a=Math.ceil(o.measureText(n).width);i.width=a+40,i.height=56*1.7,o=i.getContext("2d"),o.font="400 56px -apple-system, 'Apple SD Gothic Neo', sans-serif",o.textAlign="center",o.textBaseline="middle",o.shadowColor=nt(Ut.coral,.7),o.shadowBlur=56*.25,o.fillStyle=It.ink,o.fillText(n,i.width/2,i.height/2);const s=new B(i);return s.colorSpace=Z,s.anisotropy=8,{tex:s,aspect:i.width/i.height}}function Xs(n){const t=document.createElement("canvas");t.width=t.height=256;const e=t.getContext("2d"),i="#"+n.toString(16).padStart(6,"0");return e.strokeStyle=i,e.lineWidth=12,e.lineCap="butt",e.setLineDash([26,20]),e.beginPath(),e.arc(128,128,104,0,Math.PI*2),e.stroke(),new B(t)}class Pe{constructor(t,e,i,o=!1){this._footRight=o,this.group=new j,this.radius=t,this.color=e,this.surface=i,this.num=null;let a=null;if(i==="floor"&&R.markShape===1)try{a=bi(this._footRight===!0)}catch{a=null}this._isFoot=!!a;const s=(this._isFoot?ye:t*2.78)*oe;this.fx=new D(new K(s,s),zs(a)),this.fx.position.z=.002,this._baseGain=i==="wall"?.6:1,this.fx.material.uniforms.uGain.value=this._baseGain,this.group.add(this.fx),i==="floor"&&(this.group.rotation.x=-Math.PI/2,this.group.position.y=.012),this.group.renderOrder=5}setSelected(t){if(t&&!this.sel){this.sel=new j;const e=(i,o,a,s,l)=>{const h=new D(new Pi(i,o,48),new wt({color:a,transparent:!0,opacity:s,depthWrite:!1,side:Qt}));return h.renderOrder=l,h};this.sel.add(e(this.radius*1.44,this.radius*1.58,790034,.85,6)),this.sel.add(e(this.radius*1.32,this.radius*1.44,16777215,.95,7)),this.sel.position.z=.005,this.group.add(this.sel)}this.sel&&(this.sel.visible=!!t)}setNumber(t){this._numN=t;const e=new wt({map:De(t),transparent:!0,depthWrite:!1}),i=this.radius*2.78*re.RATIO/.75*(this._isFoot?1:Xe);this.num=new D(new K(i,i),e),this.num.position.z=.004;const o=this.fx?.material?.uniforms;o?.uNumTex&&(o.uNumTex.value=e.map,o.uNumScale.value=i/(this.radius*2.78)),this.group.add(this.num)}setContract(t="reach"){this.contract=t,this.fx.material.uniforms.uContract.value=t==="avoid"?1:0}render(t,e,i,o){const a=this.group;if(t==="hidden"){a.visible=!1,this._lastPhase="hidden";return}a.visible=!0;const s=performance.now()/1e3;t!==this._lastPhase&&((this._lastPhase==="hidden"||this._lastPhase==null)&&(t==="preview"||t==="countdown")&&(this._spawnT=s),t==="linger"&&(this._hitT=s),this._lastPhase=t);let l=1;if(this._spawnT!=null){const r=(s-this._spawnT)/.38;if(r<1){const v=1-Math.pow(1-r,3);l*=.55+.45*v+.1*Math.sin(Math.min(1,r)*Math.PI)}}if(this._hitT!=null){const r=(s-this._hitT)/.3;r<1&&(l*=1+.3*(1-r)*(1-r))}a.scale.setScalar(o*vt.markScale*l);const h=Wt?Ws:Ae,p=h[Math.min(i,h.length-1)];if(this.fx.visible){const r=this.fx.material.uniforms;r.uTime.value=performance.now()/1e3,r.uPhase.value=t==="preview"?0:t==="countdown"?1:t==="locked"?3:t==="miss"?4:2,r.uProg.value=e,r.uFade.value=p,r.uStrong.value=this.strongPreview?1:0,r.uW.value=Mt.core,r.uHalo.value=Mt.halo,r.uPool.value=Mt.pool,r.uSweepA.value=Mt.sweep,r.uNoise.value=Mt.wobble,r.uUIAmt&&(r.uUIOrigin.value.set(Y.ox,0,Y.oz),r.uUIFwd.value.set(Y.fx,0,Y.fz),r.uUIRight.value.set(Y.rx,0,Y.rz),r.uUIHalfL.value=Y.halfL,r.uUIHalfW.value=Y.halfW,r.uUIFeather.value=Y.feather,r.uUIAmt.value=this.surface==="wall"?0:Y.amt);const v=t==="linger"?1+.9*Math.max(0,1-e*2.2):1;r.uGain.value=this._baseGain*R.gainBoost*(Wt?1.35:1)*v;const u=R.day||R.markBlend==="ink"?1:0;r.uDay.value!==u&&(r.uDay.value=u,this.fx.material.blending=u?qt:ht,this.fx.material.needsUpdate=!0)}if(this.num&&(this.num.material.opacity=R.hideOrderNums&&!this._numFoot?0:t==="preview"?(this.strongPreview?1:.5)*p:t==="countdown"?1:t==="linger"?.4*(1-e):t==="locked"?.48*p:t==="miss"?.3*(1-e):1),this.num&&this.fx?.material?.uniforms?.uHT){const r=this.fx.material.uniforms,v=r.uHT.value>.5;r.uNumOn.value=v&&this.num.material.opacity>.01?1:0,r.uNumOff.value.set(this.num.position.x/(this.radius*1.39),this.num.position.y/(this.radius*1.39)),v?this.num.visible=!1:this.num.visible||(this.num.visible=!0)}if(this.num&&this._isFoot&&R.numFoot){const r=R.numFoot,v=r[R.footCtx==="in"?"in":"out"]||r.L||(r.R?{x:1-r.R.x,y:r.R.y,s:r.R.s}:null);if(v){const u=re.anchor(v,this._footRight,ye*oe);this.num.position.set(u.x,u.y,.004),this.num.scale.setScalar(u.s)}}}}const kt=[];function Se(n,{tips:t=1,wall:e=!1}={}){const i=new j,o=document.createElement("canvas");o.width=128,o.height=256;const a=new B(o);a.colorSpace=Z,a.anisotropy=4;const s=new D(new K(n*.5,n),new wt({map:a,transparent:!0,depthWrite:!1,blending:ht}));return s.position.y=n/2,i.add(s),i._len=n,i._canvas=o,i._tex=a,i._mesh=s,i._paintT=-9,i._noTip=t===0,i._tips=[],e?(i.rotation.x=0,i.position.y=0):(i.rotation.x=-Math.PI/2,i.position.y=.014),i.renderOrder=6,i._wall=!!e,kt.push(i),i}function Vs(n,t,e=0){const i=n?._fp;if(!i)return 1;const o=(u,x,k)=>{const C=Math.max(0,Math.min(1,(k-u)/(x-u)));return C*C*(3-2*C)},a=.25+e,s=t.x-i.ox,l=t.z-i.oz,h=s*i.fx+l*i.fz,p=s*i.rx+l*i.rz,r=Math.max(0,Math.min(1,(h-n.fpNear)/Math.max(.01,n.fpFar-n.fpNear))),v=n._halfAt(n.fpNear)+(n._halfAt(n.fpFar)-n._halfAt(n.fpNear))*r;return o(n.fpNear,n.fpNear+a,h)*o(n.fpFar,n.fpFar-a,h)*o(v,v-a,Math.abs(p))}function ta(n,t){tt.map.TIP_TRI||(tt.map.TIP_TRI="./ready-view/assets/arrow_tip.svg",tt.set(tt.map)),tt.map.LIFT_TIP||(tt.map.LIFT_TIP="./ready-view/assets/lift_tip.svg",tt.set(tt.map));const e=R.day||R.markBlend==="ink"?1:0,i={lut:yi,glyph:Re,arrow:R.arrow||{}};for(let o=kt.length-1;o>=0;o--){const a=kt[o];if(!a.parent){kt.splice(o,1);continue}n-a._paintT>=1/24&&(a._paintT=n,Ve(a._canvas.getContext("2d"),128,256,n,i,{noTip:a._noTip,prog:a._prog}),a._tex.needsUpdate=!0);const s=t?._fp,l=a._mesh.material;if(s&&!a._wall){const h=v=>Vs(t,v),p=new b,r=new b;a.getWorldPosition(p),a._mesh.getWorldPosition(r),r.multiplyScalar(2).sub(p),l.opacity=Math.min(h(p),h(r))*(a._gain??1)}else l.opacity=a._gain??1;l._day!==e&&(l._day=e,l.blending=e?qt:ht,l.needsUpdate=!0)}}class ea{constructor(t,e){this.scene=t,this.effects=e,this.params={lead:.7,size:1,maxVisible:3},this.root=new j,t.add(this.root),this.floorRoot=new j,this.wallRoot=new j,this.root.add(this.floorRoot,this.wallRoot),this.events=[],this.ambient=[],this.pack=null,this.layout=null,this.duration=0,this.onEvent=null,this.footprintTest=null,this.gazeTest=null,this.stats={inGaze:0,total:0},this.floorClip=null,this.wallClip=null}_applyClip(t,e){e&&t.traverse(i=>{i.material&&(i.material.clippingPlanes=e)})}_floorClipFor(){return this.layoutPreview?null:this.floorClip}setCompare(t){if(this._compareRoot){for(const s of this._compareRoot)s.removeFromParent();this._compareRoot=null}if(!t||!this.pack||t.sport!==this.pack.sport)return;const e=new j,i=new j,o=Xs(10134445),a=()=>new wt({map:o,transparent:!0,opacity:.5,depthWrite:!1});for(const s of t.tokens)if(s.type==="stepMark"){const l=this._mapFloor(s),h=new D(new K(.4,.4),a());h.rotation.x=-Math.PI/2,h.position.set(l.x,.011,l.z),h.renderOrder=3,this._applyClip(h,this._floorClipFor()),e.add(h)}else if(s.type==="targetMark"&&this.pack.hasWall){const l=this._mapWall(s),h=new D(new K(.34,.34),a());h.position.set(l.x,l.y,l.z-.005),h.renderOrder=3,this._applyClip(h,this.wallClip),i.add(h)}this.floorRoot.add(e),this.wallRoot.add(i),this._compareRoot=[e,i]}recolor(){for(const t of this.events)if(t.marker){const e=et[t.marker.role]??et.left;t.marker.color=e,t.color=e}}setParams(t){Object.assign(this.params,t)}setPack(t){this.floorRoot.clear(),this.wallRoot.clear(),this._compareRoot=null,this.laneFX=null,this.floorRoot.position.set(0,0,0),this.events=[],this.ambient=[],this.pack=t,this.layout=js[t.sport],this.duration=t.duration;const e=this.layout,i=new Map;for(const a of t.tokens){if(a.type==="pathLane"||a.lifetime>=t.duration*.85){this.ambient.push(a);continue}const l=Math.round(a.t*1e3);i.has(l)||i.set(l,{t:a.t,tokens:[]}),i.get(l).tokens.push(a)}const o=t.sport==="boxing";for(const a of[...i.values()].sort((s,l)=>s.t-l.t)){const s={t:a.t,fired:!1,marker:null,arrow:null,surface:"floor",pos:new b,color:16777215,foot:null};let l=null;for(const h of a.tokens)if(!(o&&(h.type==="orderPulse"&&(l=h.n),h.type!=="targetMark"))){if(h.type==="stepMark"||h.type==="targetMark"||h.type==="orderPulse"&&!s.marker){const p=h.type==="targetMark"&&this.pack.hasWall,r=h.type==="targetMark"?et.target:et[h.foot]??et.left,v=h.radiusCm?h.radiusCm/100:h.type==="targetMark"?Vt.loose:Vt.base,u=new Pe(v,r,p?"wall":"floor",h.foot==="right");!p&&(h.contract&&h.contract!=="reach"||h.holdRing)&&u.setContract(h.contract),u.role=h.type==="targetMark"?"target":h.foot??"left",s.marker=u,s.surface=p?"wall":"floor",s.color=r,s.foot=h.foot??null,s.srcToken=h,(p?this.wallRoot:this.floorRoot).add(u.group),this._applyClip(u.group,p?this.wallClip:this._floorClipFor())}if(h.type==="orderPulse"&&s.marker&&!s.marker.num&&!s.marker._skipNumber&&s.marker.setNumber(h.n),h.type==="directionGuide"){const p=Se(t.sport==="basketball"?.9:.55),r=this._mapFloor(h);p.position.x=r.x,p.position.z=r.z,p.rotation.z=Fe.degToRad(-(h.angle??0)),s.arrow={obj:p,t:h.t,lifetime:h.lifetime},this.floorRoot.add(p),this._applyClip(p,this._floorClipFor())}}o&&s.marker&&l!=null&&!s.marker.num&&(s.marker.setNumber(l),this._applyClip(s.marker.group,this.wallClip)),(s.marker||s.arrow)&&this.events.push(s)}if(t.sport==="basketball"){const a=this.events.filter(s=>s.surface==="floor"&&s.marker).sort((s,l)=>s.t-l.t);for(let s=0;s<a.length;s++){const l=a[s],h=a[s+1],p=a[s-1],r=this._mapFloor(l.srcToken);if(l.arrow&&h){const v=this._mapFloor(h.srcToken),u=v.x-r.x,x=v.z-r.z;l.arrow.obj.rotation.z=Math.atan2(-u,-x),l.arrow.obj.position.x=r.x,l.arrow.obj.position.z=r.z}if(p){const v=this._mapFloor(p.srcToken);let u=r.x-v.x,x=r.z-v.z;const k=Math.hypot(u,x)||1;u/=k,x/=k;const C=new j,M=Math.atan2(-u,-x);for(let F=0;F<3;F++){const T=Se(.5,{tips:0});T.rotation.z=M+Math.PI/2,T.position.set(r.x-u*(.4+F*.24),.011,r.z-x*(.4+F*.24)),T.renderOrder=4,T._gain=.55-F*.13,C.add(T)}l.stripes=C,this.floorRoot.add(C),this._applyClip(C,this._floorClipFor())}}}for(const a of this.ambient)if(a.type==="pathLane"&&this._buildLane(t),a.type==="stepMark"&&!o){const s=new Pe(Vt.base,et[a.foot]??et.left,"floor");s.role=a.foot??"left";const l=this._mapFloor(a);s.group.position.x=l.x,s.group.position.z=l.z,s.render("preview",0,0,1),s.isStance=!0,this.floorRoot.add(s.group),this._applyClip(s.group,this._floorClipFor()),this.stanceMarks=this.stanceMarks||[],this.stanceMarks.push(s)}{const a=(t.tokens||[]).filter(l=>l.type==="stepMark"&&l.t!=null).map(l=>l.t).sort((l,h)=>l-h),s=[];for(let l=1;l<a.length;l++){const h=a[l]-a[l-1];h>.05&&s.push(h)}s.sort((l,h)=>l-h),this._beatT=s.length?s[Math.floor(s.length/2)]:0,this._strideM=e.mode==="advance"&&this._beatT?e.V*this._beatT:0}if(o&&this.pack.hasWall){const a=this.events.filter(s=>s.surface==="wall"&&s.marker).sort((s,l)=>s.t-l.t);if(a.forEach((s,l)=>{!s.marker.num&&!s.marker._skipNumber&&s.marker.setNumber(l+1)}),a.length){const s=a.reduce((v,u)=>v+this._mapWall(u.srcToken).y,0)/a.length,l=this.layout.WALL,h=new ge(new Ht().setFromPoints([new b(-l.XS*.72,s,gt+.012),new b(l.XS*.72,s,gt+.012)]),new ve({color:16696201,dashSize:.05,gapSize:.07,transparent:!0,opacity:.3}));h.computeLineDistances(),this.wallRoot.add(h),this._applyClip(h,this.wallClip);const p=Ks(`타깃 ${Math.round(s*100)}cm`),r=new D(new K(p.aspect*.075,.075),new wt({map:p.tex,transparent:!0,opacity:.55,depthWrite:!1}));r.position.set(l.XS*.72-p.aspect*.075/2,s+.065,gt+.012),this.wallRoot.add(r),this._applyClip(r,this.wallClip)}}}_mapFloor(t){const e=this.layout;if(e.mode==="spatial")return{x:t.nx*e.SCALE,z:t.ny*e.SCALE};if(e.mode==="static")return{x:t.nx*e.FLOOR_SCALE,z:-t.ny*e.FLOOR_SCALE+(this.stanceOffsetZ||0)};const i=e.CAL&&e.CAL[t.foot]||{x:0,z:0};return{x:t.nx*e.X_SCALE+i.x,z:-e.V*t.t-e.STRIKE_AHEAD+i.z}}_mapWall(t){const e=this.layout.WALL;return{x:t.nx*e.XS,y:e.Y0+t.ny*e.YS,z:gt+.02}}_buildLane(t){const e=this.layout;if(e.mode==="advance"){const i=e.V*t.duration+3+1.2,o=new D(new K(.55,i),Hs(i));o.rotation.x=-Math.PI/2,o.position.set(0,.01,1.2-i/2),o.renderOrder=3,this.floorRoot.add(o),this._applyClip(o,this._floorClipFor()),this.laneFX=o}else if(e.mode==="spatial"){const i=this.pack.tokens.filter(o=>o.type==="stepMark").sort((o,a)=>o.t-a.t).map(o=>new b(o.nx*e.SCALE,.012,o.ny*e.SCALE));if(i.length>=2){const o=new xi(i),a=new Ht().setFromPoints(o.getPoints(60)),s=new ge(a,new ve({color:et.lane,dashSize:.14,gapSize:.1,transparent:!0,opacity:.7}));s.computeLineDistances(),this.floorRoot.add(s),this._applyClip(s,this._floorClipFor())}}}resetLoop(){for(const t of this.events)t.fired=!1,t._wasVisible=!1,t._verdict=null;this.stats={inGaze:0,total:0}}setShake(t,e){this.floorRoot.position.x=t,this.floorRoot.position.z=e+(this.loopShiftZ||0)}update(t,e){const{lead:i,size:o,maxVisible:a}=this.params;if(!this.layout)return;if(this.laneFX){const r=this.laneFX.material.uniforms,v=R.arrow||{};if(r.uTime.value=performance.now()/1e3,r.uW.value=R.graphics.width*(v.w||1),r.uHalo.value=R.graphics.halo*(v.glow??1),r.uGain.value=R.gainBoost*(Wt?1.25:1),r.uLStyle.value=Is[R.lane&&R.lane.style||"dash"]??1,r.uLSpeed.value=v.speed??1,r.uLGap.value=v.gap??1,this.pack?.sport==="running"&&this._beatT>0&&this._strideM>0){const k=r.uLStyle.value;if(k===1||k===2){const C=k===1?9:12;r.uLGap.value=C*this._strideM/(2*Math.PI),r.uLSpeed.value=2*Math.PI/(5.2*this._beatT)}}r.uLHeat.value=v.heat??.5,r.uLTail.value=v.tail??.55;const u=R.day||R.markBlend==="ink"?1:0;r.uDay.value!==u&&(r.uDay.value=u,this.laneFX.material.blending=u?qt:ht,this.laneFX.material.needsUpdate=!0);const x=this.rig?._fp;x&&(r.uFPOrigin.value.set(x.ox,0,x.oz),r.uFPFwd.value.set(x.fx,0,x.fz),r.uFPRight.value.set(x.rx,0,x.rz),r.uFPNear.value=this.rig.fpNear,r.uFPFar.value=this.rig.fpFar,r.uFPHalfN.value=this.rig._halfAt(this.rig.fpNear),r.uFPHalfF.value=this.rig._halfAt(this.rig.fpFar))}const l=this.rig?._fp;if(l){const r=this.rig._halfAt(this.rig.fpNear),v=this.rig._halfAt(this.rig.fpFar);for(const u of this.events){const x=u.marker?.fx?.material?.uniforms;!x||!x.uFPNear||(x.uFPOrigin.value.set(l.ox,0,l.oz),x.uFPFwd.value.set(l.fx,0,l.fz),x.uFPRight.value.set(l.rx,0,l.rz),x.uFPNear.value=this.rig.fpNear,x.uFPFar.value=this.rig.fpFar,x.uFPHalfN.value=r,x.uFPHalfF.value=v)}}const h=this.events.filter(r=>r.t>=t-vt.linger),p=new Map;h.forEach((r,v)=>p.set(r,v));for(const r of this.events){const v=p.get(r)??99;let u="hidden",x=0;const k=vt.linger+.6;r._verdict==="miss"&&t>=r.t&&t<r.t+k?(u="miss",x=(t-r.t)/k,r.fired||(r.fired=!0,this._fire(r))):t>=r.t&&t<r.t+vt.linger?(u="linger",x=(t-r.t)/vt.linger,r.fired||(r.fired=!0,this._fire(r))):t>=r.t-i&&t<r.t?(u="countdown",x=(t-(r.t-i))/i):t<r.t-i&&(u=v<a?"preview":"locked"),this.layoutPreview&&r.surface!=="wall"&&(u="preview"),this.liveHideFloorMarks&&r.surface!=="wall"&&(u="hidden"),this.laneFX&&(this.laneFX.visible=!this.liveHideLane);const C=r.marker;if(C?.num&&r.surface!=="wall"&&r.foot){const M=!!R.hideOrderNums;M!==!!C._numFoot&&(C._numFoot=M,C.num.material.map=M?Bs(r.foot==="right"):De(C._numN??""),C.num.material.needsUpdate=!0)}if(r.marker){if(r.surface==="wall"){const F=this._mapWall(r.srcToken);r.marker.group.position.set(F.x,F.y,F.z)}else{const F=this._mapFloor(r.srcToken);if(r.marker.group.position.set(F.x,.012,F.z),this.footprintTest&&u!=="hidden"&&!this.layoutPreview){const T=F.x+this.floorRoot.position.x,q=F.z+this.floorRoot.position.z,yt=r.marker.radius*o*1.15;this.footprintTest(T,q,yt)||(u="hidden");const $=u==="preview"||u==="countdown";if($&&!r._wasVisible){const Ft=this.gazeTest?this.gazeTest(T,q):!0;this.stats.total++,Ft&&this.stats.inGaze++}r._wasVisible=$}}u==="preview"&&v>=a&&!this.layoutPreview&&(u="hidden");const M=this.layoutPreview?0:Math.min(v,Ae.length-1);r.marker.strongPreview=this.layoutPreview,r.marker.render(u,x,M,o),r.stripes&&(r.stripes.visible=u==="countdown"||u==="linger")}if(r.arrow){const M=r.arrow;let F=this.layoutPreview||t>=M.t-i&&t<M.t+M.lifetime;if(F&&this.footprintTest&&!this.layoutPreview&&(F=this.footprintTest(M.obj.position.x+this.floorRoot.position.x,M.obj.position.z+this.floorRoot.position.z)),M.obj.visible=F,F){const q=.35+.55*(this.layoutPreview?1:Math.min(1,(t-(M.t-i))/Math.max(i,.001)));M.obj._gain=q,M.obj.scale.setScalar(o)}}}}_fire(t){if(t.surface!=="wall"&&!this.floorRoot.visible)return;const e=t.t<.15,i=t.marker?t.marker.group.getWorldPosition(new b):new b,o=t.surface==="wall"?new b(0,0,1):new b(0,1,0),a=t.srcToken?.design?.burst,s=a&&a.on?{...a}:{};t.surface==="wall"&&(s.sizeM=(t.marker?.radius??.15)*3.4,s.intensity=(s.intensity??1)*.8,s.speed=(s.speed??1)*1.35),t.surface!=="wall"&&this.layout?.mode==="advance"&&(s.forward=!0,i.z-=.18,s.intensity=(s.intensity??1)*1.7,s.rings=Math.max(s.rings??1,1.8)),e||this.effects.burst(i,t.color,o,s),this.onEvent&&this.onEvent(t)}studioBurst(t){if(!this.layout||!t)return;const e=this._mapFloor({nx:t.nx,ny:t.ny??0,t:t.t,foot:t.foot}),i=new b(e.x+this.floorRoot.position.x,.02,e.z+this.floorRoot.position.z),o=t.design?.burst,a=t.design?.fill?.c0||"#fa3030";this.effects.burst(i,a,new b(0,1,0),{...o&&o.on?o:{},noClip:!0})}}export{Js as B,et as C,ye as F,y as L,Mt as M,Ti as O,ea as T,Y as U,gt as W,js as a,Vs as b,Hs as c,Se as d,qs as e,vt as f,N as g,zs as m,$s as s,ta as t};
