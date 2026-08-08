import{M as w,x as le,a as Be,b as je,q as ta,Q as mt,c as gt,Z as aa,u as Fe,P as tt,N as at,g as ia}from"./fx-core-CPu9bHl8.js";import{aF as sa,V as P,aq as be,aG as _e,aa as vt,aH as _t,a6 as M,aI as oa,ak as ra,U as Nt,M as D,O as la,a2 as ze,a3 as wt,j as $,aJ as We,av as Oe,ax as ke,aK as na,aB as ha,y as ue,A as pe,a as ce,aL as ua,x as ca,aM as pa,aN as da,aO as fa,aP as ma,aQ as ga,aR as va,aS as _a,aT as wa,W as xa,aU as ba,S as Sa,aV as Pa,K as ya,aW as Ta,Y as xt,P as X,ae as Ce,aC as bt,B as K,ai as St,au as Pt,aX as Ma,_ as yt,aY as Ca,aj as Tt,s as Fa,C as V,R as ne,c as q,F as y,b as it,aZ as Ra,k as De,m as It,$ as Mt,a_ as Ct,a$ as Ea,N as st,f as La,g as ot,G as se,al as Aa,ap as Oa}from"./fxlut-B0jiDkGc.js";const Ft={type:"change"},rt={type:"start"},Ut={type:"end"},Le=new oa,Rt=new ra,ka=Math.cos(70*Nt.DEG2RAD),A=new P,W=2*Math.PI,T={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Ze=1e-6;class Da extends sa{constructor(e,t=null){super(e,t),this.state=T.NONE,this.target=new P,this.cursor=new P,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:be.ROTATE,MIDDLE:be.DOLLY,RIGHT:be.PAN},this.touches={ONE:_e.ROTATE,TWO:_e.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._domElementKeyEvents=null,this._lastPosition=new P,this._lastQuaternion=new vt,this._lastTargetPosition=new P,this._quat=new vt().setFromUnitVectors(e.up,new P(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new _t,this._sphericalDelta=new _t,this._scale=1,this._panOffset=new P,this._rotateStart=new M,this._rotateEnd=new M,this._rotateDelta=new M,this._panStart=new M,this._panEnd=new M,this._panDelta=new M,this._dollyStart=new M,this._dollyEnd=new M,this._dollyDelta=new M,this._dollyDirection=new P,this._mouse=new M,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=Ia.bind(this),this._onPointerDown=Na.bind(this),this._onPointerUp=Ua.bind(this),this._onContextMenu=Ka.bind(this),this._onMouseWheel=Wa.bind(this),this._onKeyDown=Ga.bind(this),this._onTouchStart=Ba.bind(this),this._onTouchMove=ja.bind(this),this._onMouseDown=Ha.bind(this),this._onMouseMove=za.bind(this),this._interceptControlDown=Xa.bind(this),this._interceptControlUp=Va.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(Ft),this.update(),this.state=T.NONE}update(e=null){const t=this.object.position;A.copy(t).sub(this.target),A.applyQuaternion(this._quat),this._spherical.setFromVector3(A),this.autoRotate&&this.state===T.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let i=this.minAzimuthAngle,r=this.maxAzimuthAngle;isFinite(i)&&isFinite(r)&&(i<-Math.PI?i+=W:i>Math.PI&&(i-=W),r<-Math.PI?r+=W:r>Math.PI&&(r-=W),i<=r?this._spherical.theta=Math.max(i,Math.min(r,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(i+r)/2?Math.max(i,this._spherical.theta):Math.min(r,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let a=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{const o=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),a=o!=this._spherical.radius}if(A.setFromSpherical(this._spherical),A.applyQuaternion(this._quatInverse),t.copy(this.target).add(A),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let o=null;if(this.object.isPerspectiveCamera){const n=A.length();o=this._clampDistance(n*this._scale);const h=n-o;this.object.position.addScaledVector(this._dollyDirection,h),this.object.updateMatrixWorld(),a=!!h}else if(this.object.isOrthographicCamera){const n=new P(this._mouse.x,this._mouse.y,0);n.unproject(this.object);const h=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),a=h!==this.object.zoom;const p=new P(this._mouse.x,this._mouse.y,0);p.unproject(this.object),this.object.position.sub(p).add(n),this.object.updateMatrixWorld(),o=A.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;o!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(o).add(this.object.position):(Le.origin.copy(this.object.position),Le.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(Le.direction))<ka?this.object.lookAt(this.target):(Rt.setFromNormalAndCoplanarPoint(this.object.up,this.target),Le.intersectPlane(Rt,this.target))))}else if(this.object.isOrthographicCamera){const o=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),o!==this.object.zoom&&(this.object.updateProjectionMatrix(),a=!0)}return this._scale=1,this._performCursorZoom=!1,a||this._lastPosition.distanceToSquared(this.object.position)>Ze||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Ze||this._lastTargetPosition.distanceToSquared(this.target)>Ze?(this.dispatchEvent(Ft),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?W/60*this.autoRotateSpeed*e:W/60/60*this.autoRotateSpeed}_getZoomScale(e){const t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){A.setFromMatrixColumn(t,0),A.multiplyScalar(-e),this._panOffset.add(A)}_panUp(e,t){this.screenSpacePanning===!0?A.setFromMatrixColumn(t,1):(A.setFromMatrixColumn(t,0),A.crossVectors(this.object.up,A)),A.multiplyScalar(e),this._panOffset.add(A)}_pan(e,t){const i=this.domElement;if(this.object.isPerspectiveCamera){const r=this.object.position;A.copy(r).sub(this.target);let a=A.length();a*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*a/i.clientHeight,this.object.matrix),this._panUp(2*t*a/i.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/i.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/i.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;const i=this.domElement.getBoundingClientRect(),r=e-i.left,a=t-i.top,o=i.width,n=i.height;this._mouse.x=r/o*2-1,this._mouse.y=-(a/n)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const t=this.domElement;this._rotateLeft(W*this._rotateDelta.x/t.clientHeight),this._rotateUp(W*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(W*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-W*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(W*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-W*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._rotateStart.set(i,r)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panStart.set(i,r)}}_handleTouchStartDolly(e){const t=this._getSecondPointerPosition(e),i=e.pageX-t.x,r=e.pageY-t.y,a=Math.sqrt(i*i+r*r);this._dollyStart.set(0,a)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{const i=this._getSecondPointerPosition(e),r=.5*(e.pageX+i.x),a=.5*(e.pageY+i.y);this._rotateEnd.set(r,a)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const t=this.domElement;this._rotateLeft(W*this._rotateDelta.x/t.clientHeight),this._rotateUp(W*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),r=.5*(e.pageY+t.y);this._panEnd.set(i,r)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){const t=this._getSecondPointerPosition(e),i=e.pageX-t.x,r=e.pageY-t.y,a=Math.sqrt(i*i+r*r);this._dollyEnd.set(0,a),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);const o=(e.pageX+t.x)*.5,n=(e.pageY+t.y)*.5;this._updateZoomParameters(o,n)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new M,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){const t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){const t=e.deltaMode,i={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:i.deltaY*=16;break;case 2:i.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(i.deltaY*=10),i}}function Na(s){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(s.pointerId),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(s)&&(this._addPointer(s),s.pointerType==="touch"?this._onTouchStart(s):this._onMouseDown(s)))}function Ia(s){this.enabled!==!1&&(s.pointerType==="touch"?this._onTouchMove(s):this._onMouseMove(s))}function Ua(s){switch(this._removePointer(s),this._pointers.length){case 0:this.domElement.releasePointerCapture(s.pointerId),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(Ut),this.state=T.NONE;break;case 1:const e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function Ha(s){let e;switch(s.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case be.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(s),this.state=T.DOLLY;break;case be.ROTATE:if(s.ctrlKey||s.metaKey||s.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(s),this.state=T.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(s),this.state=T.ROTATE}break;case be.PAN:if(s.ctrlKey||s.metaKey||s.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(s),this.state=T.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(s),this.state=T.PAN}break;default:this.state=T.NONE}this.state!==T.NONE&&this.dispatchEvent(rt)}function za(s){switch(this.state){case T.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(s);break;case T.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(s);break;case T.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(s);break}}function Wa(s){this.enabled===!1||this.enableZoom===!1||this.state!==T.NONE||(s.preventDefault(),this.dispatchEvent(rt),this._handleMouseWheel(this._customWheelEvent(s)),this.dispatchEvent(Ut))}function Ga(s){this.enabled!==!1&&this._handleKeyDown(s)}function Ba(s){switch(this._trackPointer(s),this._pointers.length){case 1:switch(this.touches.ONE){case _e.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(s),this.state=T.TOUCH_ROTATE;break;case _e.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(s),this.state=T.TOUCH_PAN;break;default:this.state=T.NONE}break;case 2:switch(this.touches.TWO){case _e.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(s),this.state=T.TOUCH_DOLLY_PAN;break;case _e.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(s),this.state=T.TOUCH_DOLLY_ROTATE;break;default:this.state=T.NONE}break;default:this.state=T.NONE}this.state!==T.NONE&&this.dispatchEvent(rt)}function ja(s){switch(this._trackPointer(s),this.state){case T.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(s),this.update();break;case T.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(s),this.update();break;case T.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(s),this.update();break;case T.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(s),this.update();break;default:this.state=T.NONE}}function Ka(s){this.enabled!==!1&&s.preventDefault()}function Xa(s){s.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function Va(s){s.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}const Ne={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

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


		}`};class Pe{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}const Ya=new la(-1,1,1,-1,0,1);class Za extends ze{constructor(){super(),this.setAttribute("position",new wt([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new wt([0,2,0,0,2,0],2))}}const Qa=new Za;class lt{constructor(e){this._mesh=new D(Qa,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,Ya)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class Ie extends Pe{constructor(e,t="tDiffuse"){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof $?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=We.clone(e.uniforms),this.material=new $({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new lt(this.material)}render(e,t,i){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=i.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class Et extends Pe{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,i){const r=e.getContext(),a=e.state;a.buffers.color.setMask(!1),a.buffers.depth.setMask(!1),a.buffers.color.setLocked(!0),a.buffers.depth.setLocked(!0);let o,n;this.inverse?(o=0,n=1):(o=1,n=0),a.buffers.stencil.setTest(!0),a.buffers.stencil.setOp(r.REPLACE,r.REPLACE,r.REPLACE),a.buffers.stencil.setFunc(r.ALWAYS,o,4294967295),a.buffers.stencil.setClear(n),a.buffers.stencil.setLocked(!0),e.setRenderTarget(i),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),a.buffers.color.setLocked(!1),a.buffers.depth.setLocked(!1),a.buffers.color.setMask(!0),a.buffers.depth.setMask(!0),a.buffers.stencil.setLocked(!1),a.buffers.stencil.setFunc(r.EQUAL,1,4294967295),a.buffers.stencil.setOp(r.KEEP,r.KEEP,r.KEEP),a.buffers.stencil.setLocked(!0)}}class qa extends Pe{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class Lt{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){const i=e.getSize(new M);this._width=i.width,this._height=i.height,t=new Oe(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:ke}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new Ie(Ne),this.copyPass.material.blending=na,this.clock=new ha}swapBuffers(){const e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){const t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){e===void 0&&(e=this.clock.getDelta());const t=this.renderer.getRenderTarget();let i=!1;for(let r=0,a=this.passes.length;r<a;r++){const o=this.passes[r];if(o.enabled!==!1){if(o.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(r),o.render(this.renderer,this.writeBuffer,this.readBuffer,e,i),o.needsSwap){if(i){const n=this.renderer.getContext(),h=this.renderer.state.buffers.stencil;h.setFunc(n.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),h.setFunc(n.EQUAL,1,4294967295)}this.swapBuffers()}Et!==void 0&&(o instanceof Et?i=!0:o instanceof qa&&(i=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){const t=this.renderer.getSize(new M);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;const i=this._width*this._pixelRatio,r=this._height*this._pixelRatio;this.renderTarget1.setSize(i,r),this.renderTarget2.setSize(i,r);for(let a=0;a<this.passes.length;a++)this.passes[a].setSize(i,r)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class $a extends Pe{constructor(e,t,i=null,r=null,a=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=i,this.clearColor=r,this.clearAlpha=a,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new ue}render(e,t,i){const r=e.autoClear;e.autoClear=!1;let a,o;this.overrideMaterial!==null&&(o=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(a=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:i),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(a),this.overrideMaterial!==null&&(this.scene.overrideMaterial=o),e.autoClear=r}}const Ja={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new ue(0)},defaultOpacity:{value:0}},vertexShader:`

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

		}`};class Se extends Pe{constructor(e,t=1,i,r){super(),this.strength=t,this.radius=i,this.threshold=r,this.resolution=e!==void 0?new M(e.x,e.y):new M(256,256),this.clearColor=new ue(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let a=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);this.renderTargetBright=new Oe(a,o,{type:ke}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let l=0;l<this.nMips;l++){const v=new Oe(a,o,{type:ke});v.texture.name="UnrealBloomPass.h"+l,v.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(v);const u=new Oe(a,o,{type:ke});u.texture.name="UnrealBloomPass.v"+l,u.texture.generateMipmaps=!1,this.renderTargetsVertical.push(u),a=Math.round(a/2),o=Math.round(o/2)}const n=Ja;this.highPassUniforms=We.clone(n.uniforms),this.highPassUniforms.luminosityThreshold.value=r,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new $({uniforms:this.highPassUniforms,vertexShader:n.vertexShader,fragmentShader:n.fragmentShader}),this.separableBlurMaterials=[];const h=[3,5,7,9,11];a=Math.round(this.resolution.x/2),o=Math.round(this.resolution.y/2);for(let l=0;l<this.nMips;l++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(h[l])),this.separableBlurMaterials[l].uniforms.invSize.value=new M(1/a,1/o),a=Math.round(a/2),o=Math.round(o/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;const p=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=p,this.bloomTintColors=[new P(1,1,1),new P(1,1,1),new P(1,1,1),new P(1,1,1),new P(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=We.clone(Ne.uniforms),this.blendMaterial=new $({uniforms:this.copyUniforms,vertexShader:Ne.vertexShader,fragmentShader:Ne.fragmentShader,blending:pe,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new ue,this._oldClearAlpha=1,this._basic=new ce,this._fsQuad=new lt(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let i=Math.round(e/2),r=Math.round(t/2);this.renderTargetBright.setSize(i,r);for(let a=0;a<this.nMips;a++)this.renderTargetsHorizontal[a].setSize(i,r),this.renderTargetsVertical[a].setSize(i,r),this.separableBlurMaterials[a].uniforms.invSize.value=new M(1/i,1/r),i=Math.round(i/2),r=Math.round(r/2)}render(e,t,i,r,a){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();const o=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),a&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=i.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=i.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let n=this.renderTargetBright;for(let h=0;h<this.nMips;h++)this._fsQuad.material=this.separableBlurMaterials[h],this.separableBlurMaterials[h].uniforms.colorTexture.value=n.texture,this.separableBlurMaterials[h].uniforms.direction.value=Se.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[h]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[h].uniforms.colorTexture.value=this.renderTargetsHorizontal[h].texture,this.separableBlurMaterials[h].uniforms.direction.value=Se.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[h]),e.clear(),this._fsQuad.render(e),n=this.renderTargetsVertical[h];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,a&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(i),this._fsQuad.render(e)),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=o}_getSeparableBlurMaterial(e){const t=[];for(let i=0;i<e;i++)t.push(.39894*Math.exp(-.5*i*i/(e*e))/e);return new $({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new M(.5,.5)},direction:{value:new M(.5,.5)},gaussianCoefficients:{value:t}},vertexShader:`varying vec2 vUv;
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
				}`})}_getCompositeMaterial(e){return new $({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
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
				}`})}}Se.BlurDirectionX=new M(1,0);Se.BlurDirectionY=new M(0,1);const Ae={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
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

		}`};class ei extends Pe{constructor(){super(),this.uniforms=We.clone(Ae.uniforms),this.material=new ua({name:Ae.name,uniforms:this.uniforms,vertexShader:Ae.vertexShader,fragmentShader:Ae.fragmentShader}),this._fsQuad=new lt(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,i){this.uniforms.tDiffuse.value=i.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},ca.getTransfer(this._outputColorSpace)===pa&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===da?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===fa?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===ma?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===ga?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===va?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===_a?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===wa&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}const k={bloomThreshold:.55,bloomStrength:.55,bloomRadius:.6,grain:0,vignette:.12,exposure:1,alphaOut:!1,alphaFloor:0,alphaGamma:1,inkAlpha:!1},ti={uniforms:{tDiffuse:{value:null},uGrain:{value:k.grain},uVignette:{value:k.vignette},uExposure:{value:k.exposure},uTime:{value:0},uAlphaOut:{value:0},uAlphaFloor:{value:0},uAlphaGamma:{value:1}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`
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
    }`},we=-1.8;function xi(s){const e=new URLSearchParams(location.search).get("alpha")==="1",t=new xa({antialias:!0,alpha:e,premultipliedAlpha:!1});e&&t.setClearColor(0,0),t.setPixelRatio(Math.min(window.devicePixelRatio,2));const i=t.capabilities.getMaxAnisotropy();t.setSize(s.clientWidth,s.clientHeight),t.shadowMap.enabled=!0,t.shadowMap.type=ba,t.localClippingEnabled=!0,s.appendChild(t.domElement);const r=new Sa;r.background=new ue(790034),r.fog=new Pa(790034,9,20);const a=new ya(50,s.clientWidth/s.clientHeight,.05,60),o=new Da(a,t.domElement);o.enableDamping=!0,o.dampingFactor=.08,o.maxPolarAngle=Math.PI*.495,o.minDistance=1.2,o.maxDistance=14,r.add(new Ta(3752527,1119258,1.1));const n=new xt(16777215,1.5);n.position.set(3,6,4),n.castShadow=!0,n.shadow.mapSize.set(2048,2048),n.shadow.camera.left=-5,n.shadow.camera.right=5,n.shadow.camera.top=5,n.shadow.camera.bottom=-5,r.add(n);const h=new xt(5227511,.35);h.position.set(-4,3,-3),r.add(h);const p=new D(new X(120,120),new Ce({color:1514016,roughness:.92,metalness:.05}));p.rotation.x=-Math.PI/2,p.receiveShadow=!0,r.add(p);const l=new bt(120,240,2304051,1777706);l.position.y=.002,r.add(l);const v=new K,u=new D(new X(5,3.2),new Ce({color:1843240,roughness:.95}));u.position.set(0,1.6,we),u.receiveShadow=!0,v.add(u);const x=new bt(5,10,2765120,2304567);x.rotation.x=Math.PI/2,x.position.set(0,1.6,we+.005),v.add(x),r.add(v);const O=(()=>{const c=new K,_=3.05,d=-7,f=.225,g=d-.15,b=new Ce({color:2830134,roughness:.6,metalness:.3}),S=new D(new St(1.8,1.05,.03),new Ce({color:15594231,roughness:.25,metalness:.05,transparent:!0,opacity:.55}));S.position.set(0,_+.375,g-.015),S.castShadow=!0,c.add(S);const H=new Pt(new Ma(new St(.59,.45,.001)),new yt({color:15229482}));H.position.set(0,_+.19,g+.02),c.add(H);const N=new D(new Ca(f,.014,10,28),new Ce({color:15229482,roughness:.4,metalness:.5}));N.rotation.x=Math.PI/2,N.position.set(0,_,d),N.castShadow=!0,c.add(N);const L=12,z=.4,G=.09,B=(I,Jt)=>Array.from({length:L},(vi,ea)=>{const ft=ea/L*Math.PI*2;return new P(Math.cos(ft)*I,Jt,d+Math.sin(ft)*I)}),me=B(f,_),ge=B((f+G)/2,_-z*.5),re=B(G,_-z),Xe=[];for(let I=0;I<L;I++)Xe.push(me[I],ge[I],ge[I],re[I]);for(let I=0;I<L;I++)Xe.push(ge[I],ge[(I+1)%L],re[I],re[(I+1)%L]);const $t=new Pt(new ze().setFromPoints(Xe),new yt({color:16119280,transparent:!0,opacity:.75}));c.add($t);const Ve=new D(new Tt(.05,.06,S.position.y+.4,12),b);Ve.position.set(0,(S.position.y+.4)/2,g-.35),Ve.castShadow=!0,c.add(Ve);const Ye=new D(new Tt(.035,.035,.36,10),b);return Ye.rotation.x=Math.PI/2,Ye.position.set(0,S.position.y,g-.18),c.add(Ye),c.visible=!1,c.name="hoop",r.add(c),c})();let C=null;function R(){O.visible=C==="basketball"&&["court","court_tile","court_gray","court_black"].includes(Te)}const E=new Fa,F={},ee="./";function ye(c,_,d){return new Promise(f=>{E.load(`${ee}tex/${c}`,g=>{g.wrapS=g.wrapT=ne,g.repeat.set(_,d),g.anisotropy=i,g.colorSpace=q,f(g)})})}async function te(c){if(F[c])return F[c];if(c==="grass")F.grass=await ye("grass.jpg",60,60);else if(c==="paving")F.paving=await ye("paving.jpg",50,50);else if(c==="plaster")F.plaster=await ye("plaster.jpg",2.5,1.6);else if(c==="court_tile"){const _=document.createElement("canvas");_.width=_.height=512;const d=_.getContext("2d"),f=128;d.fillStyle="#DCDEDF",d.fillRect(0,0,512,512);for(let b=0;b<4;b++)for(let S=0;S<4;S++){const H=S*f,N=b*f,L=(S*7+b*13)%5/5;d.fillStyle=`rgb(${214+L*10|0},${217+L*10|0},${219+L*10|0})`,d.fillRect(H,N,f,f),d.strokeStyle="rgba(150,156,161,0.5)",d.lineWidth=2,d.strokeRect(H+1,N+1,f-2,f-2),d.strokeStyle="rgba(156,163,169,0.62)",d.lineWidth=1.1;const z=f/4;for(let G=0;G<4;G++)for(let B=0;B<4;B++){const me=H+G*z,ge=N+B*z;for(let re=0;re<2;re++)d.beginPath(),d.roundRect(me+4+re*13,ge+5,11,z-10,3.5),d.stroke()}}const g=new V(_);g.wrapS=g.wrapT=ne,g.repeat.set(120,120),g.anisotropy=i,g.colorSpace=q,F.court_tile=g}else if(c==="ivorywood"){const _=document.createElement("canvas");_.width=_.height=512;const d=_.getContext("2d"),f=(()=>{let S=11;return()=>(S=S*16807%2147483647)/2147483647})(),g=74;for(let S=0;S*g<512+g;S++){const H=S%2*190;for(let N=-1;N<3;N++){const L=N*380+H,z=S*g,G=.962+f()*.072;d.fillStyle=`rgb(${Math.min(255,236*G)|0}, ${Math.min(255,230*G)|0}, ${Math.min(255,222*G)|0})`,d.fillRect(L,z,380,g),d.strokeStyle="rgba(196,186,170,0.34)",d.lineWidth=1.4,d.strokeRect(L+.7,z+.7,380-1.4,g-1.4),d.strokeStyle="rgba(204,195,180,0.20)",d.lineWidth=1;for(let B=0;B<3;B++){const me=z+12+f()*(g-24);d.beginPath(),d.moveTo(L+8,me),d.lineTo(L+372,me+(f()-.5)*5),d.stroke()}}}const b=new V(_);b.wrapS=b.wrapT=ne,b.repeat.set(46,46),b.anisotropy=i,b.colorSpace=q,F.ivorywood=b}else if(c==="track"){const _=await new Promise(b=>{const S=new Image;S.onload=()=>b(S),S.src=`${ee}tex/asphalt.jpg`}),d=document.createElement("canvas");d.width=d.height=512;const f=d.getContext("2d");f.fillStyle="#B7C6AA",f.fillRect(0,0,512,512),f.globalAlpha=.34,f.globalCompositeOperation="overlay",f.drawImage(_,0,0,512,512),f.globalAlpha=.12,f.globalCompositeOperation="saturation",f.fillStyle="#808080",f.fillRect(0,0,512,512),f.globalAlpha=1,f.globalCompositeOperation="source-over";const g=new V(d);g.wrapS=g.wrapT=ne,g.repeat.set(60,60),g.anisotropy=i,g.colorSpace=q,F.track=g}else if(c==="dirt"){const _=await new Promise(b=>{const S=new Image;S.onload=()=>b(S),S.src=`${ee}tex/asphalt.jpg`}),d=document.createElement("canvas");d.width=d.height=512;const f=d.getContext("2d");f.fillStyle="#C4BBA4",f.fillRect(0,0,512,512),f.globalAlpha=.4,f.globalCompositeOperation="overlay",f.drawImage(_,0,0,512,512),f.globalAlpha=.16,f.globalCompositeOperation="saturation",f.fillStyle="#808080",f.fillRect(0,0,512,512),f.globalAlpha=1,f.globalCompositeOperation="source-over",f.strokeStyle="rgba(120,110,92,0.35)",f.lineWidth=2,f.beginPath(),f.moveTo(0,256),f.lineTo(512,262),f.moveTo(256,0),f.lineTo(250,512),f.stroke();const g=new V(d);g.wrapS=g.wrapT=ne,g.repeat.set(24,24),g.anisotropy=i,g.colorSpace=q,F.dirt=g}else if(c==="indoorwood"){const _=document.createElement("canvas");_.width=_.height=512;const d=_.getContext("2d"),f=(()=>{let b=7;return()=>(b=b*16807%2147483647)/2147483647})();for(let b=0;b<8;b++){const S=b%2*128;for(let H=-1;H<3;H++){const N=H*256+S,L=b*64,z=.82+f()*.3;d.fillStyle=`rgb(${Math.round(168*z)}, ${Math.round(126*z)}, ${Math.round(84*z)})`,d.fillRect(N,L,256,64),d.strokeStyle="rgba(70,48,30,0.55)",d.lineWidth=2,d.strokeRect(N+1,L+1,254,62),d.strokeStyle="rgba(90,62,40,0.25)",d.lineWidth=1;for(let G=0;G<4;G++){const B=L+10+f()*46;d.beginPath(),d.moveTo(N+6,B),d.lineTo(N+250,B+(f()-.5)*6),d.stroke()}}}const g=new V(_);g.wrapS=g.wrapT=ne,g.repeat.set(26,26),g.anisotropy=i,g.colorSpace=q,F.indoorwood=g}else if(c==="wallpaper"){const _=document.createElement("canvas");_.width=_.height=256;const d=_.getContext("2d");d.fillStyle="#F6F5F2",d.fillRect(0,0,256,256);const f=(()=>{let b=13;return()=>(b=b*16807%2147483647)/2147483647})();for(let b=0;b<256;b+=2){const S=.02+f()*.045;d.fillStyle=f()<.5?`rgba(208,205,198,${S})`:`rgba(255,255,255,${S})`,d.fillRect(b,0,1+f()*1.5,256)}for(let b=0;b<90;b++)d.fillStyle=`rgba(196,188,174,${.03+f()*.04})`,d.fillRect(f()*256,f()*256,1,3+f()*9);const g=new V(_);g.wrapS=g.wrapT=ne,g.repeat.set(9,5),g.anisotropy=i,g.colorSpace=q,F.wallpaper=g}return F[c]}let Re=0,Te=null;function ht(){return Te==="indoor"?15723490:!Te||Te==="none"?8291727:12173514}function ut(){if(!U)return;const c=ht();r.background.setHex(c),r.fog.color.setHex(c)}let Y=null,Z=null,J=null;function Bt(){if(J)return J;J=new K;const c=new ce({color:16316660,transparent:!0,opacity:.85,depthWrite:!1}),_=[.95,2.85,4.75];for(const d of _)for(const f of[-1,1]){const g=new D(new X(.055,80),c);g.rotation.x=-Math.PI/2,g.position.set(f*d,.002,0),J.add(g)}return J.renderOrder=-1,r.add(J),J}async function jt(c){const _=++Re;if(Te=!c||c==="none"?null:c,!c||c==="none"){p.material.map=null,p.material.color.setHex(U?6712438:1514016),u.material.map=null,u.material.color.setHex(U?7765126:1843240),u.material.emissive?.setHex(0),p.material.needsUpdate=!0,u.material.needsUpdate=!0,l.visible=!0,x.visible=!0,Y&&(Y.visible=!1),Z&&(Z.visible=!1),R(),ut();return}const d=c==="court_gray"||c==="court_black",f=c==="indoor"?"ivorywood":c==="court"?"indoorwood":c,[g,b]=await Promise.all([d?null:te(f),te("plaster")]);if(_===Re){if(!Y){const H=new $({uniforms:{uColor:{value:new ue(16448245)},uOpacity:{value:.85},uHalf:{value:.025}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`
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
          }`,transparent:!0,depthWrite:!1});Y=new D(new X(16,16),H),Y.rotation.x=-Math.PI/2,Y.position.y=.006,Y.renderOrder=-1,Y.name="courtLines",r.add(Y)}if(!Z){const S=new $({uniforms:{uTint:{value:new ue(11975358)},uOut:{value:.5},uKey:{value:.22}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`
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
          }`,transparent:!0,depthWrite:!1});Z=new D(new X(60,60),S),Z.rotation.x=-Math.PI/2,Z.position.y=.005,Z.renderOrder=-2,Z.name="courtZones",r.add(Z)}if(Z.visible=c==="court_tile",Y.visible=c==="court"||c==="court_tile"||d,c==="track"?Bt().visible=!0:J&&(J.visible=!1),p.material.map=d?null:g,u.material.map=b,d)p.material.color.setHex(c==="court_black"?2502721:2830912),p.material.roughness=c==="court_black"?.42:.6,p.material.metalness=c==="court_black"?.22:.12,u.material.map=await te("wallpaper"),u.material.color.setHex(16777215),u.material.emissive?.setHex(U?7236195:5722955);else if(c==="court_tile"||c==="track"){const S=c==="court_tile";p.material.roughness=S?.78:.92,p.material.metalness=S?.04:.05,p.material.color.setHex(U?14474975:12567753),u.material.map=await te("wallpaper"),u.material.color.setHex(16777215),u.material.emissive?.setHex(U?7236195:5722955)}else c==="indoor"||c==="court"?(p.material.roughness=.92,p.material.metalness=.05,p.material.color.setHex(c==="indoor"?U?16249577:14209218:U?16183784:14209218),u.material.map=await te("wallpaper"),u.material.color.setHex(16777215),u.material.emissive?.setHex(U?7236195:5722955)):(u.material.emissive?.setHex(0),p.material.roughness=.92,p.material.metalness=.05,p.material.color.setHex(U?14408667:9079434),u.material.color.setHex(U?14869218:10132122));p.material.needsUpdate=!0,u.material.needsUpdate=!0,l.visible=!1,x.visible=!1,R(),ut()}}const ct={running:{pos:[2.9,2.1,2.9],look:[0,.7,-.6]},boxing:{pos:[3.5,1.9,3.9],look:[0,1.1,-.1]},basketball:{pos:[3.4,2.6,2.6],look:[0,.6,-1]}};function Kt(c){const _=ct[c]||ct.running;a.position.set(..._.pos),o.target.set(..._.look),o.update()}function Xt(c,_){v.visible=!!_,C=c,R(),Kt(c)}const de=r.children.find(c=>c.isHemisphereLight);let U=!1;function Vt(c){if(U=!!c,k.day=U,U){const _=ht();r.background.setHex(_),r.fog.color.setHex(_),r.fog.near=14,r.fog.far=40,de.color.setHex(14476526),de.groundColor.setHex(8291468),de.intensity=1.1,n.intensity=1.6,n.color.setHex(16774112),h.intensity=.12,p.material.map||p.material.color.setHex(6712438),u.material.map||u.material.color.setHex(7765126),p.material.map&&p.material.color.setHex(14408667),u.material.map&&u.material.color.setHex(14869218)}else r.background.setHex(790034),r.fog.color.setHex(790034),r.fog.near=9,r.fog.far=20,de.color.setHex(3752527),de.groundColor.setHex(1119258),de.intensity=1.1,n.intensity=1.5,n.color.setHex(16777215),h.intensity=.35,p.material.map||p.material.color.setHex(1514016),u.material.map||u.material.color.setHex(1843240),p.material.map&&p.material.color.setHex(9079434),u.material.map&&u.material.color.setHex(10132122);p.material.needsUpdate=!0,u.material.needsUpdate=!0}const ae=new Lt(t),Ke=new $a(r,a);ae.addPass(Ke),ae.addPass(new Ie({uniforms:{tDiffuse:{value:null}},vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);if(c.r!=c.r||c.g!=c.g||c.b!=c.b||c.a!=c.a)c=vec4(0.0);gl_FragColor=clamp(c,0.0,60.0);}"}));const Me=new Se(new M(s.clientWidth/2,s.clientHeight/2),k.bloomStrength,k.bloomRadius,k.bloomThreshold);ae.addPass(Me),ae.renderToScreen=!1;const fe=new Lt(t);fe.addPass(Ke);const pt=new Ie({uniforms:{tDiffuse:{value:null},tBloom:{value:ae.renderTarget2.texture},uInkAlpha:{value:0}},vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"uniform sampler2D tDiffuse,tBloom;uniform float uInkAlpha;varying vec2 vUv;void main(){vec4 s=texture2D(tDiffuse,vUv),b=texture2D(tBloom,vUv);gl_FragColor=vec4(s.rgb+b.rgb, mix(s.a+b.a, s.a, uInkAlpha));}"});fe.addPass(pt);const ie=new Ie(ti);fe.addPass(ie),fe.addPass(new ei);const Ee=[];function Yt(){Ee.length=0,r.traverse(c=>{c.visible&&c.material?._noBloom&&(c.visible=!1,Ee.push(c))})}function Zt(){for(const c of Ee)c.visible=!0;Ee.length=0}function Qt(c){Me.threshold=k.bloomThreshold+(k.day?.38:0),Me.strength=k.bloomStrength,Me.radius=k.bloomRadius,ie.uniforms.uGrain.value=k.grain,ie.uniforms.uVignette.value=k.vignette,ie.uniforms.uExposure.value=k.exposure,ie.uniforms.uTime.value=c,ie.uniforms.uAlphaOut.value=k.alphaOut?1:0,ie.uniforms.uAlphaFloor.value=k.alphaFloor||0,ie.uniforms.uAlphaGamma.value=k.alphaGamma||1,pt.uniforms.uInkAlpha.value=k.inkAlpha?1:0,Yt(),ae.render(),Zt(),fe.render()}function dt(){t.domElement.style.width="0px",t.domElement.style.height="0px";const c=s.clientWidth,_=s.clientHeight;a.aspect=c/_,a.updateProjectionMatrix(),t.setSize(c,_),ae.setSize(c,_),fe.setSize(c,_),Me.setSize(c/2,_/2)}window.addEventListener("resize",dt);function qt(c){const _=Math.round(c/2)*2;p.position.z=_,l.position.z=_}return{renderer:t,scene:r,camera:a,controls:o,setPackEnvironment:Xt,resize:dt,renderFrame:Qt,composer:ae,setSurfaces:jt,setDaylight:Vt,followFloor:qt,wall:u,wallGroup:v,hoop:O,setRenderCamera:c=>{Ke.camera=c}}}const Ht=`
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
}`,ai=`
uniform float uHT, uHTPitch, uHTGain, uHTSoft, uHTWave, uHTGlow, uHTInner;
uniform sampler2D uNumTex; uniform float uNumOn, uNumScale; uniform vec2 uNumOff;   // 하프톤 스킨 — 후보랩 확정본
#include <common>
#include <clipping_planes_pars_fragment>
`+It+`
uniform float uW, uHalo, uNoise;
`+ta+`
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
  // ★ uHT 는 이제 **양**이다(0..1). 예전엔 0.5 문턱의 on/off 라 '은은하게'가 불가능했다 —
  //   하프톤이 필을 통째로 갈아치우거나 아예 없거나 둘뿐이었다. 아래에서 mix 로 섞는다.
  //   1 이면 예전과 픽셀 동일(완전 대체), 0 이면 통과 — 기존 소비처는 둘 중 하나만 쓴다.
  if (uHT > 0.001) {
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
    // ★ 도트 농도 = 압력 — 각인 도트(fx-core press)와 **같은 규약**을 하프톤 스킨에도 건다.
    //   (이 블록은 JS 템플릿 리터럴 안이다 — 주석에 백틱을 쓰면 문자열이 거기서 끊긴다.)
    //   전엔 점 크기가 실루엣 경계(edge)만 따라서 발 전체에 균일하게 깔렸다: 격자는 보여도
    //   앞볼·뒤꿈치가 안 읽힌다(유저 08-06 레퍼런스: 밀도가 다르다). plantar 는 **신발 전체**에
    //   깔리므로 자국 바깥까지 같은 규약으로 덮인다. uPlantar 0 이면 예전 그대로(롤백 지점).
    float prH   = plantar(uv, mkSDIn(uv), sdh);
    //   ★ 진짜 하프톤은 **점 면적**이 밝기에 비례한다 — 반지름은 그 제곱근이다. 선형으로
    //     곱하면 중간톤이 다 비슷한 크기로 뭉쳐 '무지성 격자'로 읽힌다(유저). sqrt 를 씌우면
    //     어두운 쪽이 빠르게 가늘어져 톤이 점 크기로 읽힌다.
    //   바닥값은 이제 낮춰도 된다 — uHT 가 양(mix)이라 점이 성겨져도 아래 필이 비친다.
    float press = mix(1.0, sqrt(clamp(0.10 + 0.90 * prH, 0.0, 1.0)), clamp(uPlantar, 0.0, 1.0));
    //   ★ 상한이 피치의 절반이면 점이 셀 안에 갇혀 **절대 안 붙는다** — 어느 톤에서나 같은
    //     격자가 보인다(유저: 무지성 도트). 0.72(대각선 절반 0.707 너머)까지 열어야
    //     가장 진한 자리에서 점이 서로 붙어 면이 되고, 옅은 쪽으로 갈수록 풀린다 = 하프톤.
    float rad  = pit * 0.72 * clamp((0.62 + 0.30 * band) * uHTGain * edge * press, 0.0, 1.0);
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
    // ★ 도트를 **접지한 자리에만** 남긴다. 실루엣 전체에 깔면 바깥까지 점이 있어 산만하다(유저).
    //   섞는 양도 압력을 따른다 — 크기(위 press)와 같은 규약을 불투명도에 한 번 더 건다.
    //   압력장이 꺼져 있으면(uPlantar 0) 예전처럼 전면에 깔린다.
    float htW = clamp(uHT, 0.0, 1.0)
              * mix(1.0, smoothstep(0.04, 0.42, prH), clamp(uPlantar, 0.0, 1.0));
    r = mix(r, vec4(c0 * aNew, aNew), htW);
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
}`,ii=`
#include <common>
#include <clipping_planes_pars_fragment>
`+It+`
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
}`,si={solid:0,dash:1,dot:2,chevron:3,comet:4,taper:5},Q={ox:0,oz:0,fx:0,fz:-1,rx:1,rz:0,halfL:0,halfW:0,feather:.3,amt:0};function oi(s){const e=new $({vertexShader:Ht,fragmentShader:ii,uniforms:{uLUT:{value:De()},uTime:{value:0},uLen:{value:s},uW:{value:1},uHalo:{value:.9},uGain:{value:1},uLStyle:{value:1},uLSpeed:{value:1},uLGap:{value:1},uLHeat:{value:.5},uLTail:{value:.55},uDay:{value:0},uOut:{value:1},uFPOrigin:{value:new P},uFPFwd:{value:new P(0,0,-1)},uFPRight:{value:new P(1,0,0)},uFPNear:{value:-1e6},uFPFar:{value:1e6},uFPHalfN:{value:1e6},uFPHalfF:{value:1e6},uFPFadeM:{value:.15}},transparent:!0,blending:pe,depthWrite:!1,side:it});return e.clipping=!0,e._src="LANEFX",e}const he=Be/je,j={core:w.w,halo:w.halo,pool:w.pool,sweep:.4,wobble:w.noise,rip:w.rip,tap:w.tap||null};if(w.prims){y.prims=y.prims||{};for(const s in w.prims)y.prims[s]={...y.prims[s]||{},...w.prims[s]}}y.primBloom=w.bloom;function ri(s=null){const e=new $({vertexShader:Ht,fragmentShader:ai,uniforms:{uLUT:{value:De()},uUIOrigin:{value:new P},uUIFwd:{value:new P(0,0,-1)},uUIRight:{value:new P(1,0,0)},uUIHalfL:{value:0},uUIHalfW:{value:0},uUIFeather:{value:.3},uUIAmt:{value:0},uShape:{value:s?1:0},uRadius:{value:s?1:1.5652173913043477},uSDF2:{value:s||De()},uSDFWarn:{value:Ra()||De()},uImp:{value:s?w.imp:0},uImpPitch:{value:w.pitch*he},uImpDot:{value:w.dot},uImpGlow:{value:w.glow},uImpShade:{value:w.shade},uImpSharp:{value:w.sharp},uImpShadeCol:{value:w.shadeCol},uImpDotCol:{value:w.dotCol},uImpEdge:{value:w.edge*he},uImpScale:{value:w.scale},uImpRot:{value:(s?._right?-5.5:w.irot)*Math.PI/180},uImpCtr:{value:new M(s?(s._inCx??.5)*2-1:0,s?1-(s._inCy??.5)*2:0)},uImpOff:{value:new M((s?._right?.043:w.offx)*he,w.offy*he)},uRip:{value:w.rip},uRipSpeed:{value:w.ripSpeed},uRipWidth:{value:w.ripWidth*he},uRipReach:{value:w.ripReach*he},uEdgeShade:{value:w.edgeShade},uEdgeW:{value:w.edgeW*he},uEdgeSoft:{value:w.edgeSoft},uEdgeShadeW:{value:w.edgeShadeW},uEdgeShadeCol:{value:w.edgeShadeCol},uIceOld:{value:0},uStatePrev:{value:0},uPrevProg:{value:0},uXfade:{value:1},uEdgeShadeGrad:{value:w.edgeShadeGrad},uEdgeShadeG0:{value:w.edgeShadeG0},uEdgeShadeG1:{value:w.edgeShadeG1},uShadeRed:{value:w.shadeRed},uShadeRedW:{value:w.shadeRedW},uDither:{value:w.dither},uSilFit:{value:Be/je},uPlantar:{value:w.plantar},uBands:{value:w.bands},uBandSoft:{value:w.bandSoft},uPressA:{value:w.pressA??0},uCop:{value:new M(0,0)},uCopR:{value:new M(.4,.5)},uCopA:{value:0},uLoadBall:{value:1},uLoadHeel:{value:.62},uLoadToe:{value:.5},uLoadGain:{value:w.loadGain},uLoadBase:{value:w.loadBase},uFlow:{value:w.flow},uRipGrad:{value:w.ripGrad},uRipCol:{value:w.ripCol},uArcRev:{value:y.arcRev||0},uPhase:{value:0},uProg:{value:0},uFade:{value:1},uFillOp:{value:1},uToe:{value:0},uStrong:{value:0},uContract:{value:0},uTime:{value:0},uSeed:{value:Math.random()*6.2832},uSuccT:{value:-999},uW:{value:1},uHalo:{value:.9},uPool:{value:.55},uGain:{value:1},uTLo:{value:0},uTHi:{value:0},uDotMode:{value:0},uSweepA:{value:1},uNoise:{value:j.wobble},uDay:{value:0},uOut:{value:1},uHT:{value:0},uHTPitch:{value:.055},uHTGain:{value:1.15},uHTSoft:{value:.55},uHTWave:{value:.6},uHTGlow:{value:0},uHTInner:{value:0},uNumTex:{value:null},uNumOn:{value:0},uNumScale:{value:.311},uNumOff:{value:new M},uFPOrigin:{value:new P},uFPFwd:{value:new P(0,0,-1)},uFPRight:{value:new P(1,0,0)},uFPNear:{value:-1e6},uFPFar:{value:1e6},uFPHalfN:{value:1e6},uFPHalfF:{value:1e6},uFPFadeM:{value:.28}},transparent:!0,blending:pe,depthWrite:!1,side:it});return e.clipping=!0,e._src=s?"MARKFX(발형)":"MARKFX(존원)",e._noBloom=!0,nt.push(e),e}const nt=[],ve={ball:[.02,.3],heel:[0,-.44],toe:[.17,.56]};function bi(s,e){const t=s?.uniforms;!t||!e||(t.uLoadBall&&(t.uLoadBall.value=e.ball),t.uLoadHeel&&(t.uLoadHeel.value=e.heel),t.uLoadToe&&(t.uLoadToe.value=e.toe),s._load=e,zt(s,e))}function zt(s,e){const t=s?.uniforms;if(!Je||!t?.uCopA||!e)return;const i=Math.max(1e-4,e.ball+e.heel+e.toe),r=(e.ball*ve.ball[0]+e.heel*ve.heel[0]+e.toe*ve.toe[0])/i,a=(e.ball*ve.ball[1]+e.heel*ve.heel[1]+e.toe*ve.toe[1])/i,o=1-Math.max(e.ball,e.heel,e.toe)/i;t.uCop.value.set(r,a),t.uCopR.value.set(.19+.34*o,.16+.66*o),t.uCopA.value=i>.02?1:0}function At(s,e={}){const t=Be/je,i={imp:"uImp",dot:"uImpDot",glow:"uImpGlow",shade:"uImpShade",sharp:"uImpSharp",shadeCol:"uImpShadeCol",dotCol:"uImpDotCol",scale:"uImpScale",plantar:"uPlantar",loadGain:"uLoadGain",loadBase:"uLoadBase",flow:"uFlow",bands:"uBands",bandSoft:"uBandSoft",edgeShade:"uEdgeShade",edgeShadeW:"uEdgeShadeW",edgeShadeCol:"uEdgeShadeCol",edgeShadeGrad:"uEdgeShadeGrad",edgeShadeG0:"uEdgeShadeG0",edgeShadeG1:"uEdgeShadeG1",shadeRed:"uShadeRed",shadeRedW:"uShadeRedW",edgeSoft:"uEdgeSoft",dither:"uDither",pressA:"uPressA",rip:"uRip",ripSpeed:"uRipSpeed",ripGrad:"uRipGrad",ripCol:"uRipCol",op:"uFillOp",halo:"uHalo",w:"uW",pool:"uPool",noise:"uNoise",tLo:"uTLo",tHi:"uTHi",dotMode:"uDotMode"},r={pitch:"uImpPitch",edge:"uImpEdge",edgeW:"uEdgeW",ripWidth:"uRipWidth",ripReach:"uRipReach"},a=s.uniforms;for(const o in i)e[o]!=null&&a[i[o]]&&(a[i[o]].value=e[o]);for(const o in r)e[o]!=null&&a[r[o]]&&(a[r[o]].value=e[o]*t)}let Ue=new WeakMap,$e={},Je=!1;function Si(s={}){$e={...s},Je=!!s.contactWindow;for(const e of nt)e.uniforms.uCopA&&(Je?zt(e,e._load||{ball:.8,heel:.8,toe:.45}):e.uniforms.uCopA.value=0);Ue=new WeakMap,s.w!=null&&(j.core=s.w),s.halo!=null&&(j.halo=s.halo),s.pool!=null&&(j.pool=s.pool),ni($e)}function li(s,e){if(!s?.uniforms)return;const t=(w.states||{})[e]||(w.states||{})[String(e)]||(e===3?(w.states||{}).tap||w.tap:null),i=["imp","dot","glow","shade","sharp","scale","plantar","bands","bandSoft","edgeShade","edgeShadeW","edgeShadeGrad","edgeShadeG0","edgeShadeG1","dither","pitch","edge","edgeW","op","shadeCol","dotCol","edgeShadeCol","ripCol","edgeSoft","shadeRed","shadeRedW","rip","ripReach","ripWidth","ripSpeed","ripGrad","bloom","w"];if(!Ue.has(s)){const r={};for(const a of i){const o=$e[a]??w[a];o!=null&&(r[a]=o)}Ue.set(s,r)}At(s,Ue.get(s)),t&&At(s,t),s._stKeys=t?new Set(Object.keys(t)):null}function ni(s={}){const e=Be/je,t={imp:"uImp",dot:"uImpDot",glow:"uImpGlow",shade:"uImpShade",sharp:"uImpSharp",shadeCol:"uImpShadeCol",dotCol:"uImpDotCol",scale:"uImpScale",plantar:"uPlantar",loadGain:"uLoadGain",loadBase:"uLoadBase",flow:"uFlow",bands:"uBands",bandSoft:"uBandSoft",edgeShade:"uEdgeShade",edgeShadeW:"uEdgeShadeW",edgeShadeCol:"uEdgeShadeCol",edgeShadeGrad:"uEdgeShadeGrad",edgeShadeG0:"uEdgeShadeG0",edgeShadeG1:"uEdgeShadeG1",shadeRed:"uShadeRed",shadeRedW:"uShadeRedW",edgeSoft:"uEdgeSoft",dither:"uDither",pressA:"uPressA",rip:"uRip",ripSpeed:"uRipSpeed",ripGrad:"uRipGrad",ripCol:"uRipCol",iceOld:"uIceOld",tLo:"uTLo",tHi:"uTHi",dotMode:"uDotMode"},i={pitch:"uImpPitch",edge:"uImpEdge",edgeW:"uEdgeW",ripWidth:"uRipWidth",ripReach:"uRipReach"};for(const r of nt){const a=r.uniforms,o=a.uShape?.value===1;for(const n in t)s[n]==null||!a[t[n]]||n==="imp"&&!o||(a[t[n]].value=s[n]);for(const n in i)s[n]!=null&&a[i[n]]&&(a[i[n]].value=s[n]*e)}if(s.halo!=null&&(y.mark.halo=s.halo),s.w!=null&&(y.mark.core=s.w,y.arrow&&(y.arrow.w=s.w)),s.w!=null&&(j.core=s.w),s.halo!=null&&(j.halo=s.halo),s.pool!=null&&(j.pool=s.pool),s.noise!=null&&(j.wobble=s.noise),s.bloom!=null&&(y.primBloom=s.bloom),s.prims){y.prims=y.prims||{};for(const r in s.prims)y.prims[r]={...y.prims[r]||{},...s.prims[r]}}}const oe={left:le.red,right:le.red,target:le.red,guide:le.coral,lane:le.red,success:le.prism,user:le.prism},Wt=[1,.75,.55,.38],hi=typeof location>"u"||new URLSearchParams(location.search).get("xfade")!=="0",ui=[1,.78,.58,.42];let Ge=!1;function Pi(s){Ge=!!s}const et=.3,ci=.727,Ot=et/ci,Qe={base:et*.65,loose:et*1},xe={markScale:1,fillOpacity:.2,previewEdge:.5,cdContractFrom:1.9,cdGain:.6,lingerEdge:.9,linger:.35};xe.linger;const pi={running:{mode:"advance",V:2.5,STRIKE_AHEAD:.15,X_SCALE:2,LANE_W:1.6,CAL:{right:{x:-.187,z:.049},left:{x:.128,z:0}}},boxing:{mode:"static",FLOOR_SCALE:1.6,WALL:{XS:2.2,Y0:.73,YS:1.2}},basketball:{mode:"spatial",SCALE:5}},yi=5,qe={};function di(s){const e=s?"R":"L";if(qe[e])return qe[e];const t=document.createElement("canvas");t.width=t.height=128;const i=t.getContext("2d"),r=ot(i,"LOGO",64,64,96,{mirror:s});r||(i.strokeStyle=Fe(at.ink,.95),i.lineWidth=5,i.shadowColor=Fe(tt.coral,.75),i.shadowBlur=12,i.beginPath(),i.ellipse(64,64,20,34,s?.12:-.12,0,Math.PI*2),i.stroke());const a=new V(t);return a.colorSpace=q,a.anisotropy=4,r&&(qe[e]=a),a}function Gt(s){const e=document.createElement("canvas");e.width=e.height=128;const t=e.getContext("2d");ot(t,String(s),64,64,96)||(t.fillStyle=Fe(at.ink,.95),t.font="700 86px 'OffBit', -apple-system, sans-serif",t.textAlign="center",t.textBaseline="middle",t.shadowColor=Fe(tt.coral,.75),t.shadowBlur=14,t.fillText(String(s),64,70));const i=new V(e);return i.anisotropy=4,i}function fi(s){const i=document.createElement("canvas");i.width=4,i.height=4;let r=i.getContext("2d");r.font="700 56px 'OffBit', -apple-system, 'Apple SD Gothic Neo', sans-serif";const a=Math.ceil(r.measureText(s).width);i.width=a+40,i.height=56*1.7,r=i.getContext("2d"),r.font="700 56px 'OffBit', -apple-system, 'Apple SD Gothic Neo', sans-serif",r.textAlign="center",r.textBaseline="middle",r.shadowColor=Fe(tt.coral,.7),r.shadowBlur=56*.25,r.fillStyle=at.ink,r.fillText(s,i.width/2,i.height/2);const o=new V(i);return o.colorSpace=q,o.anisotropy=8,{tex:o,aspect:i.width/i.height}}function mi(s){const e=document.createElement("canvas");e.width=e.height=256;const t=e.getContext("2d"),i="#"+s.toString(16).padStart(6,"0");return t.strokeStyle=i,t.lineWidth=12,t.lineCap="butt",t.setLineDash([26,20]),t.beginPath(),t.arc(128,128,104,0,Math.PI*2),t.stroke(),new V(e)}class kt{constructor(e,t,i,r=!1){this._footRight=r,this.group=new K,this.radius=e,this.color=t,this.surface=i,this.num=null;let a=null;if(i==="floor"&&y.markShape===1)try{a=La(this._footRight===!0)}catch{a=null}this._isFoot=!!a;const o=(this._isFoot?Ot:e*2.78)*mt;this.fx=new D(new X(o,o),ri(a)),this.fx.position.z=.002,this._baseGain=i==="wall"?.6:1,this.fx.material.uniforms.uGain.value=this._baseGain,this.group.add(this.fx),i==="floor"&&(this.group.rotation.x=-Math.PI/2,this.group.position.y=.012),this.group.renderOrder=5}setSelected(e){if(e&&!this.sel){this.sel=new K;const t=(i,r,a,o,n)=>{const h=new D(new Oa(i,r,48),new ce({color:a,transparent:!0,opacity:o,depthWrite:!1,side:it}));return h.renderOrder=n,h};this.sel.add(t(this.radius*1.44,this.radius*1.58,790034,.85,6)),this.sel.add(t(this.radius*1.32,this.radius*1.44,16777215,.95,7)),this.sel.position.z=.005,this.group.add(this.sel)}this.sel&&(this.sel.visible=!!e)}setNumber(e){this._numN=e;const t=new ce({map:Gt(e),transparent:!0,depthWrite:!1}),i=this.radius*2.78*gt.RATIO/.75*(this._isFoot?1:aa);this.num=new D(new X(i,i),t),this.num.position.z=.004;const r=this.fx?.material?.uniforms;r?.uNumTex&&(r.uNumTex.value=t.map,r.uNumScale.value=i/(this.radius*2.78)),this.group.add(this.num)}setContract(e="reach"){this.contract=e,this.fx.material.uniforms.uContract.value=e==="avoid"?1:0}render(e,t,i,r){const a=this.group;if(e==="hidden"){a.visible=!1,this._lastPhase="hidden";return}a.visible=!0;const o=performance.now()/1e3;e!==this._lastPhase&&((this._lastPhase==="hidden"||this._lastPhase==null)&&(e==="preview"||e==="countdown")&&(this._spawnT=o),e==="linger"&&(this._hitT=o),this._lastPhase=e);let n=1;if(this._spawnT!=null){const l=(o-this._spawnT)/.38;if(l<1){const v=1-Math.pow(1-l,3);n*=.55+.45*v+.1*Math.sin(Math.min(1,l)*Math.PI)}}if(this._hitT!=null){const l=(o-this._hitT)/.3;l<1&&(n*=1+.3*(1-l)*(1-l))}a.scale.setScalar(r*xe.markScale*n);const h=Ge?ui:Wt,p=h[Math.min(i,h.length-1)];if(this.fx.visible){const l=this.fx.material.uniforms;l.uTime.value=performance.now()/1e3;const v=e==="preview"?0:e==="countdown"?1:e==="locked"?3:e==="miss"?4:2;if(l.uPhase.value!==v&&hi&&(l.uStatePrev.value=l.uPhase.value,l.uPrevProg.value=l.uProg.value,this._xfT=o),l.uSuccT&&(v===2&&l.uPhase.value!==2?l.uSuccT.value=l.uTime.value:v!==2&&l.uPhase.value===2&&(l.uSuccT.value=-999)),l.uPhase.value=v,li(this.fx?.material||m,v),this._xfT!=null){const C=(o-this._xfT)/.28;l.uXfade.value=C>=1?1:C,C>=1&&(this._xfT=null)}l.uProg.value=t,l.uFade.value=p,l.uStrong.value=this.strongPreview?1:0;const u=this.fx.material._stKeys;u?.has("w")||(l.uW.value=j.core),u?.has("halo")||(l.uHalo.value=j.halo),u?.has("pool")||(l.uPool.value=j.pool),l.uSweepA.value=j.sweep,l.uNoise.value=j.wobble,l.uArcRev&&(l.uArcRev.value=y.arcRev||0),l.uUIAmt&&(l.uUIOrigin.value.set(Q.ox,0,Q.oz),l.uUIFwd.value.set(Q.fx,0,Q.fz),l.uUIRight.value.set(Q.rx,0,Q.rz),l.uUIHalfL.value=Q.halfL,l.uUIHalfW.value=Q.halfW,l.uUIFeather.value=Q.feather,l.uUIAmt.value=this.surface==="wall"?0:Q.amt);const x=e==="linger"?1+.9*Math.max(0,1-t*2.2):1;l.uGain.value=this._baseGain*y.gainBoost*(Ge?1.35:1)*x;const O=y.day||y.markBlend==="ink"?1:0;l.uDay.value!==O&&(l.uDay.value=O,this.fx.material.blending=O?st:pe,this.fx.material.needsUpdate=!0)}if(this.num&&(this.num.material.opacity=y.hideOrderNums&&!this._numFoot?0:e==="preview"?(this.strongPreview?1:.5)*p:e==="countdown"?1:e==="linger"?.4*(1-t):e==="locked"?.48*p:e==="miss"?.3*(1-t):1),this.num&&this.fx?.material?.uniforms?.uHT){const l=this.fx.material.uniforms,v=l.uHT.value>.5;l.uNumOn.value=v&&this.num.material.opacity>.01?1:0,l.uNumOff.value.set(this.num.position.x/(this.radius*1.39),this.num.position.y/(this.radius*1.39)),v?this.num.visible=!1:this.num.visible||(this.num.visible=!0)}if(this.num&&this._isFoot&&y.numFoot){const l=y.numFoot,v=l[y.footCtx==="in"?"in":"out"]||l.L||(l.R?{x:1-l.R.x,y:l.R.y,s:l.R.s}:null);if(v){const u=gt.anchor(v,this._footRight,Ot*mt);this.num.position.set(u.x,u.y,.004),this.num.scale.setScalar(u.s)}}}}const He=[];function Dt(s,{tips:e=1,wall:t=!1,scale:i=1,dots:r}={}){const a=new K,o=document.createElement("canvas");o.width=128,o.height=256;const n=new V(o);n.colorSpace=q,n.anisotropy=4;const h=new D(new X(s*.5,s),new ce({map:n,transparent:!0,depthWrite:!1,blending:pe}));return h.position.y=s/2,a.add(h),a._len=s,a._canvas=o,a._tex=n,a._mesh=h,a._paintT=-9,a._noTip=e===0,a._tips=[],a._scale=i,a._dots=r??!t,t?(a.rotation.x=0,a.position.y=0):(a.rotation.x=-Math.PI/2,a.position.y=.014),a.renderOrder=6,a._wall=!!t,He.push(a),a}function gi(s,e,t=0){const i=s?._fp;if(!i)return 1;const r=(u,x,O)=>{const C=Math.max(0,Math.min(1,(O-u)/(x-u)));return C*C*(3-2*C)},a=.25+t,o=e.x-i.ox,n=e.z-i.oz,h=o*i.fx+n*i.fz,p=o*i.rx+n*i.rz,l=Math.max(0,Math.min(1,(h-s.fpNear)/Math.max(.01,s.fpFar-s.fpNear))),v=s._halfAt(s.fpNear)+(s._halfAt(s.fpFar)-s._halfAt(s.fpNear))*l;return r(s.fpNear,s.fpNear+a,h)*r(s.fpFar,s.fpFar-a,h)*r(v,v-a,Math.abs(p))}function Ti(s,e){se.map.TIP_TRI||(se.map.TIP_TRI="./ready-view/assets/arrow_tip.svg",se.set(se.map)),se.map.LIFT_TIP||(se.map.LIFT_TIP="./ready-view/assets/lift_tip.svg",se.set(se.map));const t=y.day||y.markBlend==="ink"?1:0,i={lut:Aa,glyph:ot,arrow:y.arrow||{}};for(let r=He.length-1;r>=0;r--){const a=He[r];if(!a.parent){He.splice(r,1);continue}s-a._paintT>=1/24&&(a._paintT=s,ia(a._canvas.getContext("2d"),128,256,s,i,{noTip:a._noTip,prog:a._prog,scale:a._scale,dots:a._dots}),a._tex.needsUpdate=!0);const o=e?._fp,n=a._mesh.material;if(o&&!a._wall){const h=v=>gi(e,v),p=new P,l=new P;a.getWorldPosition(p),a._mesh.getWorldPosition(l),l.multiplyScalar(2).sub(p),n.opacity=Math.min(h(p),h(l))*(a._gain??1)}else n.opacity=a._gain??1;n._day!==t&&(n._day=t,n.blending=t?st:pe,n.needsUpdate=!0)}}class Mi{constructor(e,t){this.scene=e,this.effects=t,this.params={lead:.7,size:1,maxVisible:3},this.root=new K,e.add(this.root),this.floorRoot=new K,this.wallRoot=new K,this.root.add(this.floorRoot,this.wallRoot),this.events=[],this.ambient=[],this.pack=null,this.layout=null,this.duration=0,this.onEvent=null,this.footprintTest=null,this.gazeTest=null,this.stats={inGaze:0,total:0},this.floorClip=null,this.wallClip=null}_applyClip(e,t){t&&e.traverse(i=>{i.material&&(i.material.clippingPlanes=t)})}_floorClipFor(){return this.layoutPreview?null:this.floorClip}setCompare(e){if(this._compareRoot){for(const o of this._compareRoot)o.removeFromParent();this._compareRoot=null}if(!e||!this.pack||e.sport!==this.pack.sport)return;const t=new K,i=new K,r=mi(10134445),a=()=>new ce({map:r,transparent:!0,opacity:.5,depthWrite:!1});for(const o of e.tokens)if(o.type==="stepMark"){const n=this._mapFloor(o),h=new D(new X(.4,.4),a());h.rotation.x=-Math.PI/2,h.position.set(n.x,.011,n.z),h.renderOrder=3,this._applyClip(h,this._floorClipFor()),t.add(h)}else if(o.type==="targetMark"&&this.pack.hasWall){const n=this._mapWall(o),h=new D(new X(.34,.34),a());h.position.set(n.x,n.y,n.z-.005),h.renderOrder=3,this._applyClip(h,this.wallClip),i.add(h)}this.floorRoot.add(t),this.wallRoot.add(i),this._compareRoot=[t,i]}recolor(){for(const e of this.events)if(e.marker){const t=oe[e.marker.role]??oe.left;e.marker.color=t,e.color=t}}setParams(e){Object.assign(this.params,e)}setPack(e){this.floorRoot.clear(),this.wallRoot.clear(),this._compareRoot=null,this.laneFX=null,this.floorRoot.position.set(0,0,0),this.events=[],this.ambient=[],this.pack=e,this.layout=pi[e.sport],this.duration=e.duration;const t=this.layout,i=new Map;for(const a of e.tokens){if(a.type==="pathLane"||a.lifetime>=e.duration*.85){this.ambient.push(a);continue}const n=Math.round(a.t*1e3);i.has(n)||i.set(n,{t:a.t,tokens:[]}),i.get(n).tokens.push(a)}const r=e.sport==="boxing";for(const a of[...i.values()].sort((o,n)=>o.t-n.t)){const o={t:a.t,fired:!1,marker:null,arrow:null,surface:"floor",pos:new P,color:16777215,foot:null};let n=null;for(const h of a.tokens)if(!(r&&(h.type==="orderPulse"&&(n=h.n),h.type!=="targetMark"))){if(h.type==="stepMark"||h.type==="targetMark"||h.type==="orderPulse"&&!o.marker){const p=h.type==="targetMark"&&this.pack.hasWall,l=h.type==="targetMark"?oe.target:oe[h.foot]??oe.left,v=h.radiusCm?h.radiusCm/100:h.type==="targetMark"?Qe.loose:Qe.base,u=new kt(v,l,p?"wall":"floor",h.foot==="right");!p&&(h.contract&&h.contract!=="reach"||h.holdRing)&&u.setContract(h.contract),u.role=h.type==="targetMark"?"target":h.foot??"left",o.marker=u,o.surface=p?"wall":"floor",o.color=l,o.foot=h.foot??null,o.srcToken=h,(p?this.wallRoot:this.floorRoot).add(u.group),this._applyClip(u.group,p?this.wallClip:this._floorClipFor())}if(h.type==="orderPulse"&&o.marker&&!o.marker.num&&!o.marker._skipNumber&&o.marker.setNumber(h.n),h.type==="directionGuide"){const p=Dt(e.sport==="basketball"?.9:.55),l=this._mapFloor(h);p.position.x=l.x,p.position.z=l.z,p.rotation.z=Nt.degToRad(-(h.angle??0)),o.arrow={obj:p,t:h.t,lifetime:h.lifetime},this.floorRoot.add(p),this._applyClip(p,this._floorClipFor())}}r&&o.marker&&n!=null&&!o.marker.num&&(o.marker.setNumber(n),this._applyClip(o.marker.group,this.wallClip)),(o.marker||o.arrow)&&this.events.push(o)}if(e.sport==="basketball"){const a=this.events.filter(o=>o.surface==="floor"&&o.marker).sort((o,n)=>o.t-n.t);for(let o=0;o<a.length;o++){const n=a[o],h=a[o+1],p=a[o-1],l=this._mapFloor(n.srcToken);if(n.arrow&&h){const v=this._mapFloor(h.srcToken),u=v.x-l.x,x=v.z-l.z;n.arrow.obj.rotation.z=Math.atan2(-u,-x),n.arrow.obj.position.x=l.x,n.arrow.obj.position.z=l.z}if(p){const v=this._mapFloor(p.srcToken);let u=l.x-v.x,x=l.z-v.z;const O=Math.hypot(u,x)||1;u/=O,x/=O;const C=new K,R=Math.atan2(-u,-x);for(let E=0;E<3;E++){const F=Dt(.5,{tips:0});F.rotation.z=R+Math.PI/2,F.position.set(l.x-u*(.4+E*.24),.011,l.z-x*(.4+E*.24)),F.renderOrder=4,F._gain=.55-E*.13,C.add(F)}n.stripes=C,this.floorRoot.add(C),this._applyClip(C,this._floorClipFor())}}}for(const a of this.ambient)if(a.type==="pathLane"&&this._buildLane(e),a.type==="stepMark"&&!r){const o=new kt(Qe.base,oe[a.foot]??oe.left,"floor");o.role=a.foot??"left";const n=this._mapFloor(a);o.group.position.x=n.x,o.group.position.z=n.z,o.render("preview",0,0,1),o.isStance=!0,this.floorRoot.add(o.group),this._applyClip(o.group,this._floorClipFor()),this.stanceMarks=this.stanceMarks||[],this.stanceMarks.push(o)}{const a=(e.tokens||[]).filter(n=>n.type==="stepMark"&&n.t!=null).map(n=>n.t).sort((n,h)=>n-h),o=[];for(let n=1;n<a.length;n++){const h=a[n]-a[n-1];h>.05&&o.push(h)}o.sort((n,h)=>n-h),this._beatT=o.length?o[Math.floor(o.length/2)]:0,this._strideM=t.mode==="advance"&&this._beatT?t.V*this._beatT:0}if(r&&this.pack.hasWall){const a=this.events.filter(o=>o.surface==="wall"&&o.marker).sort((o,n)=>o.t-n.t);if(a.forEach((o,n)=>{!o.marker.num&&!o.marker._skipNumber&&o.marker.setNumber(n+1)}),a.length){const o=a.reduce((v,u)=>v+this._mapWall(u.srcToken).y,0)/a.length,n=this.layout.WALL,h=new Mt(new ze().setFromPoints([new P(-n.XS*.72,o,we+.012),new P(n.XS*.72,o,we+.012)]),new Ct({color:16696201,dashSize:.05,gapSize:.07,transparent:!0,opacity:.3}));h.computeLineDistances(),this.wallRoot.add(h),this._applyClip(h,this.wallClip);const p=fi(`타깃 ${Math.round(o*100)}cm`),l=new D(new X(p.aspect*.075,.075),new ce({map:p.tex,transparent:!0,opacity:.55,depthWrite:!1}));l.position.set(n.XS*.72-p.aspect*.075/2,o+.065,we+.012),this.wallRoot.add(l),this._applyClip(l,this.wallClip)}}}_mapFloor(e){const t=this.layout;if(t.mode==="spatial")return{x:e.nx*t.SCALE,z:e.ny*t.SCALE};if(t.mode==="static")return{x:e.nx*t.FLOOR_SCALE,z:-e.ny*t.FLOOR_SCALE+(this.stanceOffsetZ||0)};const i=t.CAL&&t.CAL[e.foot]||{x:0,z:0};return{x:e.nx*t.X_SCALE+i.x,z:-t.V*e.t-t.STRIKE_AHEAD+i.z}}_mapWall(e){const t=this.layout.WALL;return{x:e.nx*t.XS,y:t.Y0+e.ny*t.YS,z:we+.02}}_buildLane(e){const t=this.layout;if(t.mode==="advance"){const i=t.V*e.duration+3+1.2,r=new D(new X(.55,i),oi(i));r.rotation.x=-Math.PI/2,r.position.set(0,.01,1.2-i/2),r.renderOrder=3,this.floorRoot.add(r),this._applyClip(r,this._floorClipFor()),this.laneFX=r}else if(t.mode==="spatial"){const i=this.pack.tokens.filter(r=>r.type==="stepMark").sort((r,a)=>r.t-a.t).map(r=>new P(r.nx*t.SCALE,.012,r.ny*t.SCALE));if(i.length>=2){const r=new Ea(i),a=new ze().setFromPoints(r.getPoints(60)),o=new Mt(a,new Ct({color:oe.lane,dashSize:.14,gapSize:.1,transparent:!0,opacity:.7}));o.computeLineDistances(),this.floorRoot.add(o),this._applyClip(o,this._floorClipFor())}}}resetLoop(){for(const e of this.events)e.fired=!1,e._wasVisible=!1,e._verdict=null;this.stats={inGaze:0,total:0}}setShake(e,t){this.floorRoot.position.x=e,this.floorRoot.position.z=t+(this.loopShiftZ||0)}update(e,t){const{lead:i,size:r,maxVisible:a}=this.params;if(!this.layout)return;if(this.laneFX){const l=this.laneFX.material.uniforms,v=y.arrow||{};if(l.uTime.value=performance.now()/1e3,l.uW.value=y.graphics.width*(v.w||1),l.uHalo.value=y.graphics.halo*(v.glow??1),l.uGain.value=y.gainBoost*(Ge?1.25:1),l.uLStyle.value=si[y.lane&&y.lane.style||"dash"]??1,l.uLSpeed.value=v.speed??1,l.uLGap.value=v.gap??1,this.pack?.sport==="running"&&this._beatT>0&&this._strideM>0){const O=l.uLStyle.value;if(O===1||O===2){const C=O===1?9:12;l.uLGap.value=C*this._strideM/(2*Math.PI),l.uLSpeed.value=2*Math.PI/(5.2*this._beatT)}}l.uLHeat.value=v.heat??.5,l.uLTail.value=v.tail??.55;const u=y.day||y.markBlend==="ink"?1:0;l.uDay.value!==u&&(l.uDay.value=u,this.laneFX.material.blending=u?st:pe,this.laneFX.material.needsUpdate=!0);const x=this.rig?._fp;x&&(l.uFPOrigin.value.set(x.ox,0,x.oz),l.uFPFwd.value.set(x.fx,0,x.fz),l.uFPRight.value.set(x.rx,0,x.rz),l.uFPNear.value=this.rig.fpNear,l.uFPFar.value=this.rig.fpFar,l.uFPHalfN.value=this.rig._halfAt(this.rig.fpNear),l.uFPHalfF.value=this.rig._halfAt(this.rig.fpFar))}const n=this.rig?._fp;if(n){const l=this.rig._halfAt(this.rig.fpNear),v=this.rig._halfAt(this.rig.fpFar);for(const u of this.events){const x=u.marker?.fx?.material?.uniforms;!x||!x.uFPNear||(x.uFPOrigin.value.set(n.ox,0,n.oz),x.uFPFwd.value.set(n.fx,0,n.fz),x.uFPRight.value.set(n.rx,0,n.rz),x.uFPNear.value=this.rig.fpNear,x.uFPFar.value=this.rig.fpFar,x.uFPHalfN.value=l,x.uFPHalfF.value=v)}}const h=this.events.filter(l=>l.t>=e-xe.linger),p=new Map;h.forEach((l,v)=>p.set(l,v));for(const l of this.events){const v=p.get(l)??99;let u="hidden",x=0;const O=xe.linger+.6;l._verdict==="miss"&&e>=l.t&&e<l.t+O?(u="miss",x=(e-l.t)/O,l.fired||(l.fired=!0,this._fire(l))):e>=l.t&&e<l.t+xe.linger?(u="linger",x=(e-l.t)/xe.linger,l.fired||(l.fired=!0,this._fire(l))):e>=l.t-i&&e<l.t?(u="countdown",x=(e-(l.t-i))/i):e<l.t-i&&(u=v<a?"preview":"locked"),this.layoutPreview&&l.surface!=="wall"&&(u="preview"),this.liveHideFloorMarks&&l.surface!=="wall"&&(u="hidden"),this.laneFX&&(this.laneFX.visible=!this.liveHideLane);const C=l.marker;if(C?.num&&l.surface!=="wall"&&l.foot){const R=!!y.hideOrderNums;R!==!!C._numFoot&&(C._numFoot=R,C.num.material.map=R?di(l.foot==="right"):Gt(C._numN??""),C.num.material.needsUpdate=!0)}if(l.marker){if(l.surface==="wall"){const E=this._mapWall(l.srcToken);l.marker.group.position.set(E.x,E.y,E.z)}else{const E=this._mapFloor(l.srcToken);if(l.marker.group.position.set(E.x,.012,E.z),this.footprintTest&&u!=="hidden"&&!this.layoutPreview){const F=E.x+this.floorRoot.position.x,ee=E.z+this.floorRoot.position.z,ye=l.marker.radius*r*1.15;this.footprintTest(F,ee,ye)||(u="hidden");const te=u==="preview"||u==="countdown";if(te&&!l._wasVisible){const Re=this.gazeTest?this.gazeTest(F,ee):!0;this.stats.total++,Re&&this.stats.inGaze++}l._wasVisible=te}}u==="preview"&&v>=a&&!this.layoutPreview&&(u="hidden");const R=this.layoutPreview?0:Math.min(v,Wt.length-1);l.marker.strongPreview=this.layoutPreview,l.marker.render(u,x,R,r),l.stripes&&(l.stripes.visible=u==="countdown"||u==="linger")}if(l.arrow){const R=l.arrow;let E=this.layoutPreview||e>=R.t-i&&e<R.t+R.lifetime;if(E&&this.footprintTest&&!this.layoutPreview&&(E=this.footprintTest(R.obj.position.x+this.floorRoot.position.x,R.obj.position.z+this.floorRoot.position.z)),R.obj.visible=E,E){const ee=.35+.55*(this.layoutPreview?1:Math.min(1,(e-(R.t-i))/Math.max(i,.001)));R.obj._gain=ee,R.obj.scale.setScalar(r)}}}}fieldVisible(e){return this.root.visible&&(e==="wall"?this.wallRoot:this.floorRoot).visible}_fire(e){if(!this.fieldVisible(e.surface))return;const t=e.t<.15,i=e.marker?e.marker.group.getWorldPosition(new P):new P,r=e.surface==="wall"?new P(0,0,1):new P(0,1,0),a=e.srcToken?.design?.burst,o=a&&a.on?{...a}:{};e.surface==="wall"&&(o.sizeM=(e.marker?.radius??.15)*1.9,o.intensity=(o.intensity??1)*.8,o.speed=(o.speed??1)*1.35),e.surface!=="wall"&&this.layout?.mode==="advance"&&(o.forward=!0,i.z-=.18,o.intensity=(o.intensity??1)*1.7,o.rings=Math.max(o.rings??1,1.8)),t||this.effects.burst(i,e.color,r,o),this.onEvent&&this.onEvent(e)}studioBurst(e){if(!this.layout||!e)return;const t=this._mapFloor({nx:e.nx,ny:e.ny??0,t:e.t,foot:e.foot}),i=new P(t.x+this.floorRoot.position.x,.02,t.z+this.floorRoot.position.z),r=e.design?.burst,a=e.design?.fill?.c0||"#fa3030";this.effects.burst(i,a,new P(0,1,0),{...r&&r.on?r:{},noClip:!0})}}export{yi as B,oe as C,k as F,pi as L,j as M,Da as O,Mi as T,Q as U,we as W,Qe as Z,oi as a,xe as b,xi as c,Dt as d,ni as e,Si as f,et as g,gi as h,bi as i,li as j,At as k,Ot as l,ri as m,Pi as s,Ti as t};
