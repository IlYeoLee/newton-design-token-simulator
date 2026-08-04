import{L as w,q as oe,a as Qe,b as qe,n as Vt,Q as lt,M as ht,Z as Yt,u as le,P as Ie,N as Ue,f as Zt}from"./fx-core-B5jZImdK.js";import{aF as Qt,V as S,aq as we,aG as ge,a9 as ut,aH as ct,a5 as T,aI as qt,aj as $t,Q as Ct,M as k,O as Jt,a1 as He,a2 as pt,i as Q,aJ as ze,av as Ae,ax as Le,aK as ei,aB as ti,x as he,A as ue,a as xe,aL as ii,w as ai,aM as si,aN as oi,aO as ri,aP as ni,aQ as li,aR as hi,aS as ui,aT as ci,W as pi,aU as di,S as fi,aV as mi,J as gi,aW as vi,X as dt,P as K,ad as Me,aC as ft,z as B,ah as mt,au as gt,aX as _i,Z as vt,aY as wi,ai as _t,q as xi,C as j,R as re,c as Z,F as y,b as $e,aZ as bi,j as De,l as Rt,_ as wt,a_ as xt,a$ as Si,N as Je,f as yi,g as Et,G as ie,al as Pi,ak as Ti}from"./fxlut-CDVufDlq.js";const bt={type:"change"},et={type:"start"},At={type:"end"},Re=new qt,St=new $t,Mi=Math.cos(70*Ct.DEG2RAD),A=new S,z=2*Math.PI,P={NONE:-1,ROTATE:0,DOLLY:1,PAN:2,TOUCH_ROTATE:3,TOUCH_PAN:4,TOUCH_DOLLY_PAN:5,TOUCH_DOLLY_ROTATE:6},Xe=1e-6;class Fi extends Qt{constructor(e,t=null){super(e,t),this.state=P.NONE,this.target=new S,this.cursor=new S,this.minDistance=0,this.maxDistance=1/0,this.minZoom=0,this.maxZoom=1/0,this.minTargetRadius=0,this.maxTargetRadius=1/0,this.minPolarAngle=0,this.maxPolarAngle=Math.PI,this.minAzimuthAngle=-1/0,this.maxAzimuthAngle=1/0,this.enableDamping=!1,this.dampingFactor=.05,this.enableZoom=!0,this.zoomSpeed=1,this.enableRotate=!0,this.rotateSpeed=1,this.keyRotateSpeed=1,this.enablePan=!0,this.panSpeed=1,this.screenSpacePanning=!0,this.keyPanSpeed=7,this.zoomToCursor=!1,this.autoRotate=!1,this.autoRotateSpeed=2,this.keys={LEFT:"ArrowLeft",UP:"ArrowUp",RIGHT:"ArrowRight",BOTTOM:"ArrowDown"},this.mouseButtons={LEFT:we.ROTATE,MIDDLE:we.DOLLY,RIGHT:we.PAN},this.touches={ONE:ge.ROTATE,TWO:ge.DOLLY_PAN},this.target0=this.target.clone(),this.position0=this.object.position.clone(),this.zoom0=this.object.zoom,this._domElementKeyEvents=null,this._lastPosition=new S,this._lastQuaternion=new ut,this._lastTargetPosition=new S,this._quat=new ut().setFromUnitVectors(e.up,new S(0,1,0)),this._quatInverse=this._quat.clone().invert(),this._spherical=new ct,this._sphericalDelta=new ct,this._scale=1,this._panOffset=new S,this._rotateStart=new T,this._rotateEnd=new T,this._rotateDelta=new T,this._panStart=new T,this._panEnd=new T,this._panDelta=new T,this._dollyStart=new T,this._dollyEnd=new T,this._dollyDelta=new T,this._dollyDirection=new S,this._mouse=new T,this._performCursorZoom=!1,this._pointers=[],this._pointerPositions={},this._controlActive=!1,this._onPointerMove=Ri.bind(this),this._onPointerDown=Ci.bind(this),this._onPointerUp=Ei.bind(this),this._onContextMenu=Ii.bind(this),this._onMouseWheel=Di.bind(this),this._onKeyDown=Oi.bind(this),this._onTouchStart=ki.bind(this),this._onTouchMove=Ni.bind(this),this._onMouseDown=Ai.bind(this),this._onMouseMove=Li.bind(this),this._interceptControlDown=Ui.bind(this),this._interceptControlUp=Hi.bind(this),this.domElement!==null&&this.connect(this.domElement),this.update()}connect(e){super.connect(e),this.domElement.addEventListener("pointerdown",this._onPointerDown),this.domElement.addEventListener("pointercancel",this._onPointerUp),this.domElement.addEventListener("contextmenu",this._onContextMenu),this.domElement.addEventListener("wheel",this._onMouseWheel,{passive:!1}),this.domElement.getRootNode().addEventListener("keydown",this._interceptControlDown,{passive:!0,capture:!0}),this.domElement.style.touchAction="none"}disconnect(){this.domElement.removeEventListener("pointerdown",this._onPointerDown),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.domElement.removeEventListener("pointercancel",this._onPointerUp),this.domElement.removeEventListener("wheel",this._onMouseWheel),this.domElement.removeEventListener("contextmenu",this._onContextMenu),this.stopListenToKeyEvents(),this.domElement.getRootNode().removeEventListener("keydown",this._interceptControlDown,{capture:!0}),this.domElement.style.touchAction="auto"}dispose(){this.disconnect()}getPolarAngle(){return this._spherical.phi}getAzimuthalAngle(){return this._spherical.theta}getDistance(){return this.object.position.distanceTo(this.target)}listenToKeyEvents(e){e.addEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=e}stopListenToKeyEvents(){this._domElementKeyEvents!==null&&(this._domElementKeyEvents.removeEventListener("keydown",this._onKeyDown),this._domElementKeyEvents=null)}saveState(){this.target0.copy(this.target),this.position0.copy(this.object.position),this.zoom0=this.object.zoom}reset(){this.target.copy(this.target0),this.object.position.copy(this.position0),this.object.zoom=this.zoom0,this.object.updateProjectionMatrix(),this.dispatchEvent(bt),this.update(),this.state=P.NONE}update(e=null){const t=this.object.position;A.copy(t).sub(this.target),A.applyQuaternion(this._quat),this._spherical.setFromVector3(A),this.autoRotate&&this.state===P.NONE&&this._rotateLeft(this._getAutoRotationAngle(e)),this.enableDamping?(this._spherical.theta+=this._sphericalDelta.theta*this.dampingFactor,this._spherical.phi+=this._sphericalDelta.phi*this.dampingFactor):(this._spherical.theta+=this._sphericalDelta.theta,this._spherical.phi+=this._sphericalDelta.phi);let i=this.minAzimuthAngle,a=this.maxAzimuthAngle;isFinite(i)&&isFinite(a)&&(i<-Math.PI?i+=z:i>Math.PI&&(i-=z),a<-Math.PI?a+=z:a>Math.PI&&(a-=z),i<=a?this._spherical.theta=Math.max(i,Math.min(a,this._spherical.theta)):this._spherical.theta=this._spherical.theta>(i+a)/2?Math.max(i,this._spherical.theta):Math.min(a,this._spherical.theta)),this._spherical.phi=Math.max(this.minPolarAngle,Math.min(this.maxPolarAngle,this._spherical.phi)),this._spherical.makeSafe(),this.enableDamping===!0?this.target.addScaledVector(this._panOffset,this.dampingFactor):this.target.add(this._panOffset),this.target.sub(this.cursor),this.target.clampLength(this.minTargetRadius,this.maxTargetRadius),this.target.add(this.cursor);let o=!1;if(this.zoomToCursor&&this._performCursorZoom||this.object.isOrthographicCamera)this._spherical.radius=this._clampDistance(this._spherical.radius);else{const s=this._spherical.radius;this._spherical.radius=this._clampDistance(this._spherical.radius*this._scale),o=s!=this._spherical.radius}if(A.setFromSpherical(this._spherical),A.applyQuaternion(this._quatInverse),t.copy(this.target).add(A),this.object.lookAt(this.target),this.enableDamping===!0?(this._sphericalDelta.theta*=1-this.dampingFactor,this._sphericalDelta.phi*=1-this.dampingFactor,this._panOffset.multiplyScalar(1-this.dampingFactor)):(this._sphericalDelta.set(0,0,0),this._panOffset.set(0,0,0)),this.zoomToCursor&&this._performCursorZoom){let s=null;if(this.object.isPerspectiveCamera){const l=A.length();s=this._clampDistance(l*this._scale);const h=l-s;this.object.position.addScaledVector(this._dollyDirection,h),this.object.updateMatrixWorld(),o=!!h}else if(this.object.isOrthographicCamera){const l=new S(this._mouse.x,this._mouse.y,0);l.unproject(this.object);const h=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),this.object.updateProjectionMatrix(),o=h!==this.object.zoom;const p=new S(this._mouse.x,this._mouse.y,0);p.unproject(this.object),this.object.position.sub(p).add(l),this.object.updateMatrixWorld(),s=A.length()}else console.warn("WARNING: OrbitControls.js encountered an unknown camera type - zoom to cursor disabled."),this.zoomToCursor=!1;s!==null&&(this.screenSpacePanning?this.target.set(0,0,-1).transformDirection(this.object.matrix).multiplyScalar(s).add(this.object.position):(Re.origin.copy(this.object.position),Re.direction.set(0,0,-1).transformDirection(this.object.matrix),Math.abs(this.object.up.dot(Re.direction))<Mi?this.object.lookAt(this.target):(St.setFromNormalAndCoplanarPoint(this.object.up,this.target),Re.intersectPlane(St,this.target))))}else if(this.object.isOrthographicCamera){const s=this.object.zoom;this.object.zoom=Math.max(this.minZoom,Math.min(this.maxZoom,this.object.zoom/this._scale)),s!==this.object.zoom&&(this.object.updateProjectionMatrix(),o=!0)}return this._scale=1,this._performCursorZoom=!1,o||this._lastPosition.distanceToSquared(this.object.position)>Xe||8*(1-this._lastQuaternion.dot(this.object.quaternion))>Xe||this._lastTargetPosition.distanceToSquared(this.target)>Xe?(this.dispatchEvent(bt),this._lastPosition.copy(this.object.position),this._lastQuaternion.copy(this.object.quaternion),this._lastTargetPosition.copy(this.target),!0):!1}_getAutoRotationAngle(e){return e!==null?z/60*this.autoRotateSpeed*e:z/60/60*this.autoRotateSpeed}_getZoomScale(e){const t=Math.abs(e*.01);return Math.pow(.95,this.zoomSpeed*t)}_rotateLeft(e){this._sphericalDelta.theta-=e}_rotateUp(e){this._sphericalDelta.phi-=e}_panLeft(e,t){A.setFromMatrixColumn(t,0),A.multiplyScalar(-e),this._panOffset.add(A)}_panUp(e,t){this.screenSpacePanning===!0?A.setFromMatrixColumn(t,1):(A.setFromMatrixColumn(t,0),A.crossVectors(this.object.up,A)),A.multiplyScalar(e),this._panOffset.add(A)}_pan(e,t){const i=this.domElement;if(this.object.isPerspectiveCamera){const a=this.object.position;A.copy(a).sub(this.target);let o=A.length();o*=Math.tan(this.object.fov/2*Math.PI/180),this._panLeft(2*e*o/i.clientHeight,this.object.matrix),this._panUp(2*t*o/i.clientHeight,this.object.matrix)}else this.object.isOrthographicCamera?(this._panLeft(e*(this.object.right-this.object.left)/this.object.zoom/i.clientWidth,this.object.matrix),this._panUp(t*(this.object.top-this.object.bottom)/this.object.zoom/i.clientHeight,this.object.matrix)):(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - pan disabled."),this.enablePan=!1)}_dollyOut(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale/=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_dollyIn(e){this.object.isPerspectiveCamera||this.object.isOrthographicCamera?this._scale*=e:(console.warn("WARNING: OrbitControls.js encountered an unknown camera type - dolly/zoom disabled."),this.enableZoom=!1)}_updateZoomParameters(e,t){if(!this.zoomToCursor)return;this._performCursorZoom=!0;const i=this.domElement.getBoundingClientRect(),a=e-i.left,o=t-i.top,s=i.width,l=i.height;this._mouse.x=a/s*2-1,this._mouse.y=-(o/l)*2+1,this._dollyDirection.set(this._mouse.x,this._mouse.y,1).unproject(this.object).sub(this.object.position).normalize()}_clampDistance(e){return Math.max(this.minDistance,Math.min(this.maxDistance,e))}_handleMouseDownRotate(e){this._rotateStart.set(e.clientX,e.clientY)}_handleMouseDownDolly(e){this._updateZoomParameters(e.clientX,e.clientX),this._dollyStart.set(e.clientX,e.clientY)}_handleMouseDownPan(e){this._panStart.set(e.clientX,e.clientY)}_handleMouseMoveRotate(e){this._rotateEnd.set(e.clientX,e.clientY),this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const t=this.domElement;this._rotateLeft(z*this._rotateDelta.x/t.clientHeight),this._rotateUp(z*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd),this.update()}_handleMouseMoveDolly(e){this._dollyEnd.set(e.clientX,e.clientY),this._dollyDelta.subVectors(this._dollyEnd,this._dollyStart),this._dollyDelta.y>0?this._dollyOut(this._getZoomScale(this._dollyDelta.y)):this._dollyDelta.y<0&&this._dollyIn(this._getZoomScale(this._dollyDelta.y)),this._dollyStart.copy(this._dollyEnd),this.update()}_handleMouseMovePan(e){this._panEnd.set(e.clientX,e.clientY),this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd),this.update()}_handleMouseWheel(e){this._updateZoomParameters(e.clientX,e.clientY),e.deltaY<0?this._dollyIn(this._getZoomScale(e.deltaY)):e.deltaY>0&&this._dollyOut(this._getZoomScale(e.deltaY)),this.update()}_handleKeyDown(e){let t=!1;switch(e.code){case this.keys.UP:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(z*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,this.keyPanSpeed),t=!0;break;case this.keys.BOTTOM:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateUp(-z*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(0,-this.keyPanSpeed),t=!0;break;case this.keys.LEFT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(z*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(this.keyPanSpeed,0),t=!0;break;case this.keys.RIGHT:e.ctrlKey||e.metaKey||e.shiftKey?this.enableRotate&&this._rotateLeft(-z*this.keyRotateSpeed/this.domElement.clientHeight):this.enablePan&&this._pan(-this.keyPanSpeed,0),t=!0;break}t&&(e.preventDefault(),this.update())}_handleTouchStartRotate(e){if(this._pointers.length===1)this._rotateStart.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),a=.5*(e.pageY+t.y);this._rotateStart.set(i,a)}}_handleTouchStartPan(e){if(this._pointers.length===1)this._panStart.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),a=.5*(e.pageY+t.y);this._panStart.set(i,a)}}_handleTouchStartDolly(e){const t=this._getSecondPointerPosition(e),i=e.pageX-t.x,a=e.pageY-t.y,o=Math.sqrt(i*i+a*a);this._dollyStart.set(0,o)}_handleTouchStartDollyPan(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enablePan&&this._handleTouchStartPan(e)}_handleTouchStartDollyRotate(e){this.enableZoom&&this._handleTouchStartDolly(e),this.enableRotate&&this._handleTouchStartRotate(e)}_handleTouchMoveRotate(e){if(this._pointers.length==1)this._rotateEnd.set(e.pageX,e.pageY);else{const i=this._getSecondPointerPosition(e),a=.5*(e.pageX+i.x),o=.5*(e.pageY+i.y);this._rotateEnd.set(a,o)}this._rotateDelta.subVectors(this._rotateEnd,this._rotateStart).multiplyScalar(this.rotateSpeed);const t=this.domElement;this._rotateLeft(z*this._rotateDelta.x/t.clientHeight),this._rotateUp(z*this._rotateDelta.y/t.clientHeight),this._rotateStart.copy(this._rotateEnd)}_handleTouchMovePan(e){if(this._pointers.length===1)this._panEnd.set(e.pageX,e.pageY);else{const t=this._getSecondPointerPosition(e),i=.5*(e.pageX+t.x),a=.5*(e.pageY+t.y);this._panEnd.set(i,a)}this._panDelta.subVectors(this._panEnd,this._panStart).multiplyScalar(this.panSpeed),this._pan(this._panDelta.x,this._panDelta.y),this._panStart.copy(this._panEnd)}_handleTouchMoveDolly(e){const t=this._getSecondPointerPosition(e),i=e.pageX-t.x,a=e.pageY-t.y,o=Math.sqrt(i*i+a*a);this._dollyEnd.set(0,o),this._dollyDelta.set(0,Math.pow(this._dollyEnd.y/this._dollyStart.y,this.zoomSpeed)),this._dollyOut(this._dollyDelta.y),this._dollyStart.copy(this._dollyEnd);const s=(e.pageX+t.x)*.5,l=(e.pageY+t.y)*.5;this._updateZoomParameters(s,l)}_handleTouchMoveDollyPan(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enablePan&&this._handleTouchMovePan(e)}_handleTouchMoveDollyRotate(e){this.enableZoom&&this._handleTouchMoveDolly(e),this.enableRotate&&this._handleTouchMoveRotate(e)}_addPointer(e){this._pointers.push(e.pointerId)}_removePointer(e){delete this._pointerPositions[e.pointerId];for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId){this._pointers.splice(t,1);return}}_isTrackingPointer(e){for(let t=0;t<this._pointers.length;t++)if(this._pointers[t]==e.pointerId)return!0;return!1}_trackPointer(e){let t=this._pointerPositions[e.pointerId];t===void 0&&(t=new T,this._pointerPositions[e.pointerId]=t),t.set(e.pageX,e.pageY)}_getSecondPointerPosition(e){const t=e.pointerId===this._pointers[0]?this._pointers[1]:this._pointers[0];return this._pointerPositions[t]}_customWheelEvent(e){const t=e.deltaMode,i={clientX:e.clientX,clientY:e.clientY,deltaY:e.deltaY};switch(t){case 1:i.deltaY*=16;break;case 2:i.deltaY*=100;break}return e.ctrlKey&&!this._controlActive&&(i.deltaY*=10),i}}function Ci(n){this.enabled!==!1&&(this._pointers.length===0&&(this.domElement.setPointerCapture(n.pointerId),this.domElement.addEventListener("pointermove",this._onPointerMove),this.domElement.addEventListener("pointerup",this._onPointerUp)),!this._isTrackingPointer(n)&&(this._addPointer(n),n.pointerType==="touch"?this._onTouchStart(n):this._onMouseDown(n)))}function Ri(n){this.enabled!==!1&&(n.pointerType==="touch"?this._onTouchMove(n):this._onMouseMove(n))}function Ei(n){switch(this._removePointer(n),this._pointers.length){case 0:this.domElement.releasePointerCapture(n.pointerId),this.domElement.removeEventListener("pointermove",this._onPointerMove),this.domElement.removeEventListener("pointerup",this._onPointerUp),this.dispatchEvent(At),this.state=P.NONE;break;case 1:const e=this._pointers[0],t=this._pointerPositions[e];this._onTouchStart({pointerId:e,pageX:t.x,pageY:t.y});break}}function Ai(n){let e;switch(n.button){case 0:e=this.mouseButtons.LEFT;break;case 1:e=this.mouseButtons.MIDDLE;break;case 2:e=this.mouseButtons.RIGHT;break;default:e=-1}switch(e){case we.DOLLY:if(this.enableZoom===!1)return;this._handleMouseDownDolly(n),this.state=P.DOLLY;break;case we.ROTATE:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=P.PAN}else{if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=P.ROTATE}break;case we.PAN:if(n.ctrlKey||n.metaKey||n.shiftKey){if(this.enableRotate===!1)return;this._handleMouseDownRotate(n),this.state=P.ROTATE}else{if(this.enablePan===!1)return;this._handleMouseDownPan(n),this.state=P.PAN}break;default:this.state=P.NONE}this.state!==P.NONE&&this.dispatchEvent(et)}function Li(n){switch(this.state){case P.ROTATE:if(this.enableRotate===!1)return;this._handleMouseMoveRotate(n);break;case P.DOLLY:if(this.enableZoom===!1)return;this._handleMouseMoveDolly(n);break;case P.PAN:if(this.enablePan===!1)return;this._handleMouseMovePan(n);break}}function Di(n){this.enabled===!1||this.enableZoom===!1||this.state!==P.NONE||(n.preventDefault(),this.dispatchEvent(et),this._handleMouseWheel(this._customWheelEvent(n)),this.dispatchEvent(At))}function Oi(n){this.enabled!==!1&&this._handleKeyDown(n)}function ki(n){switch(this._trackPointer(n),this._pointers.length){case 1:switch(this.touches.ONE){case ge.ROTATE:if(this.enableRotate===!1)return;this._handleTouchStartRotate(n),this.state=P.TOUCH_ROTATE;break;case ge.PAN:if(this.enablePan===!1)return;this._handleTouchStartPan(n),this.state=P.TOUCH_PAN;break;default:this.state=P.NONE}break;case 2:switch(this.touches.TWO){case ge.DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchStartDollyPan(n),this.state=P.TOUCH_DOLLY_PAN;break;case ge.DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchStartDollyRotate(n),this.state=P.TOUCH_DOLLY_ROTATE;break;default:this.state=P.NONE}break;default:this.state=P.NONE}this.state!==P.NONE&&this.dispatchEvent(et)}function Ni(n){switch(this._trackPointer(n),this.state){case P.TOUCH_ROTATE:if(this.enableRotate===!1)return;this._handleTouchMoveRotate(n),this.update();break;case P.TOUCH_PAN:if(this.enablePan===!1)return;this._handleTouchMovePan(n),this.update();break;case P.TOUCH_DOLLY_PAN:if(this.enableZoom===!1&&this.enablePan===!1)return;this._handleTouchMoveDollyPan(n),this.update();break;case P.TOUCH_DOLLY_ROTATE:if(this.enableZoom===!1&&this.enableRotate===!1)return;this._handleTouchMoveDollyRotate(n),this.update();break;default:this.state=P.NONE}}function Ii(n){this.enabled!==!1&&n.preventDefault()}function Ui(n){n.key==="Control"&&(this._controlActive=!0,this.domElement.getRootNode().addEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}function Hi(n){n.key==="Control"&&(this._controlActive=!1,this.domElement.getRootNode().removeEventListener("keyup",this._interceptControlUp,{passive:!0,capture:!0}))}const Oe={name:"CopyShader",uniforms:{tDiffuse:{value:null},opacity:{value:1}},vertexShader:`

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


		}`};class Se{constructor(){this.isPass=!0,this.enabled=!0,this.needsSwap=!0,this.clear=!1,this.renderToScreen=!1}setSize(){}render(){console.error("THREE.Pass: .render() must be implemented in derived pass.")}dispose(){}}const zi=new Jt(-1,1,1,-1,0,1);class Wi extends He{constructor(){super(),this.setAttribute("position",new pt([-1,3,0,-1,-1,0,3,-1,0],3)),this.setAttribute("uv",new pt([0,2,0,0,2,0],2))}}const Gi=new Wi;class tt{constructor(e){this._mesh=new k(Gi,e)}dispose(){this._mesh.geometry.dispose()}render(e){e.render(this._mesh,zi)}get material(){return this._mesh.material}set material(e){this._mesh.material=e}}class ke extends Se{constructor(e,t="tDiffuse"){super(),this.textureID=t,this.uniforms=null,this.material=null,e instanceof Q?(this.uniforms=e.uniforms,this.material=e):e&&(this.uniforms=ze.clone(e.uniforms),this.material=new Q({name:e.name!==void 0?e.name:"unspecified",defines:Object.assign({},e.defines),uniforms:this.uniforms,vertexShader:e.vertexShader,fragmentShader:e.fragmentShader})),this._fsQuad=new tt(this.material)}render(e,t,i){this.uniforms[this.textureID]&&(this.uniforms[this.textureID].value=i.texture),this._fsQuad.material=this.material,this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}class yt extends Se{constructor(e,t){super(),this.scene=e,this.camera=t,this.clear=!0,this.needsSwap=!1,this.inverse=!1}render(e,t,i){const a=e.getContext(),o=e.state;o.buffers.color.setMask(!1),o.buffers.depth.setMask(!1),o.buffers.color.setLocked(!0),o.buffers.depth.setLocked(!0);let s,l;this.inverse?(s=0,l=1):(s=1,l=0),o.buffers.stencil.setTest(!0),o.buffers.stencil.setOp(a.REPLACE,a.REPLACE,a.REPLACE),o.buffers.stencil.setFunc(a.ALWAYS,s,4294967295),o.buffers.stencil.setClear(l),o.buffers.stencil.setLocked(!0),e.setRenderTarget(i),this.clear&&e.clear(),e.render(this.scene,this.camera),e.setRenderTarget(t),this.clear&&e.clear(),e.render(this.scene,this.camera),o.buffers.color.setLocked(!1),o.buffers.depth.setLocked(!1),o.buffers.color.setMask(!0),o.buffers.depth.setMask(!0),o.buffers.stencil.setLocked(!1),o.buffers.stencil.setFunc(a.EQUAL,1,4294967295),o.buffers.stencil.setOp(a.KEEP,a.KEEP,a.KEEP),o.buffers.stencil.setLocked(!0)}}class Bi extends Se{constructor(){super(),this.needsSwap=!1}render(e){e.state.buffers.stencil.setLocked(!1),e.state.buffers.stencil.setTest(!1)}}class Pt{constructor(e,t){if(this.renderer=e,this._pixelRatio=e.getPixelRatio(),t===void 0){const i=e.getSize(new T);this._width=i.width,this._height=i.height,t=new Ae(this._width*this._pixelRatio,this._height*this._pixelRatio,{type:Le}),t.texture.name="EffectComposer.rt1"}else this._width=t.width,this._height=t.height;this.renderTarget1=t,this.renderTarget2=t.clone(),this.renderTarget2.texture.name="EffectComposer.rt2",this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2,this.renderToScreen=!0,this.passes=[],this.copyPass=new ke(Oe),this.copyPass.material.blending=ei,this.clock=new ti}swapBuffers(){const e=this.readBuffer;this.readBuffer=this.writeBuffer,this.writeBuffer=e}addPass(e){this.passes.push(e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}insertPass(e,t){this.passes.splice(t,0,e),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}removePass(e){const t=this.passes.indexOf(e);t!==-1&&this.passes.splice(t,1)}isLastEnabledPass(e){for(let t=e+1;t<this.passes.length;t++)if(this.passes[t].enabled)return!1;return!0}render(e){e===void 0&&(e=this.clock.getDelta());const t=this.renderer.getRenderTarget();let i=!1;for(let a=0,o=this.passes.length;a<o;a++){const s=this.passes[a];if(s.enabled!==!1){if(s.renderToScreen=this.renderToScreen&&this.isLastEnabledPass(a),s.render(this.renderer,this.writeBuffer,this.readBuffer,e,i),s.needsSwap){if(i){const l=this.renderer.getContext(),h=this.renderer.state.buffers.stencil;h.setFunc(l.NOTEQUAL,1,4294967295),this.copyPass.render(this.renderer,this.writeBuffer,this.readBuffer,e),h.setFunc(l.EQUAL,1,4294967295)}this.swapBuffers()}yt!==void 0&&(s instanceof yt?i=!0:s instanceof Bi&&(i=!1))}}this.renderer.setRenderTarget(t)}reset(e){if(e===void 0){const t=this.renderer.getSize(new T);this._pixelRatio=this.renderer.getPixelRatio(),this._width=t.width,this._height=t.height,e=this.renderTarget1.clone(),e.setSize(this._width*this._pixelRatio,this._height*this._pixelRatio)}this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.renderTarget1=e,this.renderTarget2=e.clone(),this.writeBuffer=this.renderTarget1,this.readBuffer=this.renderTarget2}setSize(e,t){this._width=e,this._height=t;const i=this._width*this._pixelRatio,a=this._height*this._pixelRatio;this.renderTarget1.setSize(i,a),this.renderTarget2.setSize(i,a);for(let o=0;o<this.passes.length;o++)this.passes[o].setSize(i,a)}setPixelRatio(e){this._pixelRatio=e,this.setSize(this._width,this._height)}dispose(){this.renderTarget1.dispose(),this.renderTarget2.dispose(),this.copyPass.dispose()}}class ji extends Se{constructor(e,t,i=null,a=null,o=null){super(),this.scene=e,this.camera=t,this.overrideMaterial=i,this.clearColor=a,this.clearAlpha=o,this.clear=!0,this.clearDepth=!1,this.needsSwap=!1,this._oldClearColor=new he}render(e,t,i){const a=e.autoClear;e.autoClear=!1;let o,s;this.overrideMaterial!==null&&(s=this.scene.overrideMaterial,this.scene.overrideMaterial=this.overrideMaterial),this.clearColor!==null&&(e.getClearColor(this._oldClearColor),e.setClearColor(this.clearColor,e.getClearAlpha())),this.clearAlpha!==null&&(o=e.getClearAlpha(),e.setClearAlpha(this.clearAlpha)),this.clearDepth==!0&&e.clearDepth(),e.setRenderTarget(this.renderToScreen?null:i),this.clear===!0&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),e.render(this.scene,this.camera),this.clearColor!==null&&e.setClearColor(this._oldClearColor),this.clearAlpha!==null&&e.setClearAlpha(o),this.overrideMaterial!==null&&(this.scene.overrideMaterial=s),e.autoClear=a}}const Ki={uniforms:{tDiffuse:{value:null},luminosityThreshold:{value:1},smoothWidth:{value:1},defaultColor:{value:new he(0)},defaultOpacity:{value:0}},vertexShader:`

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

		}`};class be extends Se{constructor(e,t=1,i,a){super(),this.strength=t,this.radius=i,this.threshold=a,this.resolution=e!==void 0?new T(e.x,e.y):new T(256,256),this.clearColor=new he(0,0,0),this.needsSwap=!1,this.renderTargetsHorizontal=[],this.renderTargetsVertical=[],this.nMips=5;let o=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);this.renderTargetBright=new Ae(o,s,{type:Le}),this.renderTargetBright.texture.name="UnrealBloomPass.bright",this.renderTargetBright.texture.generateMipmaps=!1;for(let r=0;r<this.nMips;r++){const v=new Ae(o,s,{type:Le});v.texture.name="UnrealBloomPass.h"+r,v.texture.generateMipmaps=!1,this.renderTargetsHorizontal.push(v);const u=new Ae(o,s,{type:Le});u.texture.name="UnrealBloomPass.v"+r,u.texture.generateMipmaps=!1,this.renderTargetsVertical.push(u),o=Math.round(o/2),s=Math.round(s/2)}const l=Ki;this.highPassUniforms=ze.clone(l.uniforms),this.highPassUniforms.luminosityThreshold.value=a,this.highPassUniforms.smoothWidth.value=.01,this.materialHighPassFilter=new Q({uniforms:this.highPassUniforms,vertexShader:l.vertexShader,fragmentShader:l.fragmentShader}),this.separableBlurMaterials=[];const h=[3,5,7,9,11];o=Math.round(this.resolution.x/2),s=Math.round(this.resolution.y/2);for(let r=0;r<this.nMips;r++)this.separableBlurMaterials.push(this._getSeparableBlurMaterial(h[r])),this.separableBlurMaterials[r].uniforms.invSize.value=new T(1/o,1/s),o=Math.round(o/2),s=Math.round(s/2);this.compositeMaterial=this._getCompositeMaterial(this.nMips),this.compositeMaterial.uniforms.blurTexture1.value=this.renderTargetsVertical[0].texture,this.compositeMaterial.uniforms.blurTexture2.value=this.renderTargetsVertical[1].texture,this.compositeMaterial.uniforms.blurTexture3.value=this.renderTargetsVertical[2].texture,this.compositeMaterial.uniforms.blurTexture4.value=this.renderTargetsVertical[3].texture,this.compositeMaterial.uniforms.blurTexture5.value=this.renderTargetsVertical[4].texture,this.compositeMaterial.uniforms.bloomStrength.value=t,this.compositeMaterial.uniforms.bloomRadius.value=.1;const p=[1,.8,.6,.4,.2];this.compositeMaterial.uniforms.bloomFactors.value=p,this.bloomTintColors=[new S(1,1,1),new S(1,1,1),new S(1,1,1),new S(1,1,1),new S(1,1,1)],this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,this.copyUniforms=ze.clone(Oe.uniforms),this.blendMaterial=new Q({uniforms:this.copyUniforms,vertexShader:Oe.vertexShader,fragmentShader:Oe.fragmentShader,blending:ue,depthTest:!1,depthWrite:!1,transparent:!0}),this._oldClearColor=new he,this._oldClearAlpha=1,this._basic=new xe,this._fsQuad=new tt(null)}dispose(){for(let e=0;e<this.renderTargetsHorizontal.length;e++)this.renderTargetsHorizontal[e].dispose();for(let e=0;e<this.renderTargetsVertical.length;e++)this.renderTargetsVertical[e].dispose();this.renderTargetBright.dispose();for(let e=0;e<this.separableBlurMaterials.length;e++)this.separableBlurMaterials[e].dispose();this.compositeMaterial.dispose(),this.blendMaterial.dispose(),this._basic.dispose(),this._fsQuad.dispose()}setSize(e,t){let i=Math.round(e/2),a=Math.round(t/2);this.renderTargetBright.setSize(i,a);for(let o=0;o<this.nMips;o++)this.renderTargetsHorizontal[o].setSize(i,a),this.renderTargetsVertical[o].setSize(i,a),this.separableBlurMaterials[o].uniforms.invSize.value=new T(1/i,1/a),i=Math.round(i/2),a=Math.round(a/2)}render(e,t,i,a,o){e.getClearColor(this._oldClearColor),this._oldClearAlpha=e.getClearAlpha();const s=e.autoClear;e.autoClear=!1,e.setClearColor(this.clearColor,0),o&&e.state.buffers.stencil.setTest(!1),this.renderToScreen&&(this._fsQuad.material=this._basic,this._basic.map=i.texture,e.setRenderTarget(null),e.clear(),this._fsQuad.render(e)),this.highPassUniforms.tDiffuse.value=i.texture,this.highPassUniforms.luminosityThreshold.value=this.threshold,this._fsQuad.material=this.materialHighPassFilter,e.setRenderTarget(this.renderTargetBright),e.clear(),this._fsQuad.render(e);let l=this.renderTargetBright;for(let h=0;h<this.nMips;h++)this._fsQuad.material=this.separableBlurMaterials[h],this.separableBlurMaterials[h].uniforms.colorTexture.value=l.texture,this.separableBlurMaterials[h].uniforms.direction.value=be.BlurDirectionX,e.setRenderTarget(this.renderTargetsHorizontal[h]),e.clear(),this._fsQuad.render(e),this.separableBlurMaterials[h].uniforms.colorTexture.value=this.renderTargetsHorizontal[h].texture,this.separableBlurMaterials[h].uniforms.direction.value=be.BlurDirectionY,e.setRenderTarget(this.renderTargetsVertical[h]),e.clear(),this._fsQuad.render(e),l=this.renderTargetsVertical[h];this._fsQuad.material=this.compositeMaterial,this.compositeMaterial.uniforms.bloomStrength.value=this.strength,this.compositeMaterial.uniforms.bloomRadius.value=this.radius,this.compositeMaterial.uniforms.bloomTintColors.value=this.bloomTintColors,e.setRenderTarget(this.renderTargetsHorizontal[0]),e.clear(),this._fsQuad.render(e),this._fsQuad.material=this.blendMaterial,this.copyUniforms.tDiffuse.value=this.renderTargetsHorizontal[0].texture,o&&e.state.buffers.stencil.setTest(!0),this.renderToScreen?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(i),this._fsQuad.render(e)),e.setClearColor(this._oldClearColor,this._oldClearAlpha),e.autoClear=s}_getSeparableBlurMaterial(e){const t=[];for(let i=0;i<e;i++)t.push(.39894*Math.exp(-.5*i*i/(e*e))/e);return new Q({defines:{KERNEL_RADIUS:e},uniforms:{colorTexture:{value:null},invSize:{value:new T(.5,.5)},direction:{value:new T(.5,.5)},gaussianCoefficients:{value:t}},vertexShader:`varying vec2 vUv;
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
				}`})}_getCompositeMaterial(e){return new Q({defines:{NUM_MIPS:e},uniforms:{blurTexture1:{value:null},blurTexture2:{value:null},blurTexture3:{value:null},blurTexture4:{value:null},blurTexture5:{value:null},bloomStrength:{value:1},bloomFactors:{value:null},bloomTintColors:{value:null},bloomRadius:{value:0}},vertexShader:`varying vec2 vUv;
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
				}`})}}be.BlurDirectionX=new T(1,0);be.BlurDirectionY=new T(0,1);const Ee={name:"OutputShader",uniforms:{tDiffuse:{value:null},toneMappingExposure:{value:1}},vertexShader:`
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

		}`};class Xi extends Se{constructor(){super(),this.uniforms=ze.clone(Ee.uniforms),this.material=new ii({name:Ee.name,uniforms:this.uniforms,vertexShader:Ee.vertexShader,fragmentShader:Ee.fragmentShader}),this._fsQuad=new tt(this.material),this._outputColorSpace=null,this._toneMapping=null}render(e,t,i){this.uniforms.tDiffuse.value=i.texture,this.uniforms.toneMappingExposure.value=e.toneMappingExposure,(this._outputColorSpace!==e.outputColorSpace||this._toneMapping!==e.toneMapping)&&(this._outputColorSpace=e.outputColorSpace,this._toneMapping=e.toneMapping,this.material.defines={},ai.getTransfer(this._outputColorSpace)===si&&(this.material.defines.SRGB_TRANSFER=""),this._toneMapping===oi?this.material.defines.LINEAR_TONE_MAPPING="":this._toneMapping===ri?this.material.defines.REINHARD_TONE_MAPPING="":this._toneMapping===ni?this.material.defines.CINEON_TONE_MAPPING="":this._toneMapping===li?this.material.defines.ACES_FILMIC_TONE_MAPPING="":this._toneMapping===hi?this.material.defines.AGX_TONE_MAPPING="":this._toneMapping===ui?this.material.defines.NEUTRAL_TONE_MAPPING="":this._toneMapping===ci&&(this.material.defines.CUSTOM_TONE_MAPPING=""),this.material.needsUpdate=!0),this.renderToScreen===!0?(e.setRenderTarget(null),this._fsQuad.render(e)):(e.setRenderTarget(t),this.clear&&e.clear(e.autoClearColor,e.autoClearDepth,e.autoClearStencil),this._fsQuad.render(e))}dispose(){this.material.dispose(),this._fsQuad.dispose()}}const D={bloomThreshold:.55,bloomStrength:.55,bloomRadius:.6,grain:0,vignette:.12,exposure:1,alphaOut:!1,alphaFloor:0,alphaGamma:1,inkAlpha:!1},Vi={uniforms:{tDiffuse:{value:null},uGrain:{value:D.grain},uVignette:{value:D.vignette},uExposure:{value:D.exposure},uTime:{value:0},uAlphaOut:{value:0},uAlphaFloor:{value:0},uAlphaGamma:{value:1}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`
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
    }`},ve=-1.8;function ua(n){const e=new URLSearchParams(location.search).get("alpha")==="1",t=new pi({antialias:!0,alpha:e,premultipliedAlpha:!1});e&&t.setClearColor(0,0),t.setPixelRatio(Math.min(window.devicePixelRatio,2));const i=t.capabilities.getMaxAnisotropy();t.setSize(n.clientWidth,n.clientHeight),t.shadowMap.enabled=!0,t.shadowMap.type=di,t.localClippingEnabled=!0,n.appendChild(t.domElement);const a=new fi;a.background=new he(790034),a.fog=new mi(790034,9,20);const o=new gi(50,n.clientWidth/n.clientHeight,.05,60),s=new Fi(o,t.domElement);s.enableDamping=!0,s.dampingFactor=.08,s.maxPolarAngle=Math.PI*.495,s.minDistance=1.2,s.maxDistance=14,a.add(new vi(3752527,1119258,1.1));const l=new dt(16777215,1.5);l.position.set(3,6,4),l.castShadow=!0,l.shadow.mapSize.set(2048,2048),l.shadow.camera.left=-5,l.shadow.camera.right=5,l.shadow.camera.top=5,l.shadow.camera.bottom=-5,a.add(l);const h=new dt(5227511,.35);h.position.set(-4,3,-3),a.add(h);const p=new k(new K(120,120),new Me({color:1514016,roughness:.92,metalness:.05}));p.rotation.x=-Math.PI/2,p.receiveShadow=!0,a.add(p);const r=new ft(120,240,2304051,1777706);r.position.y=.002,a.add(r);const v=new B,u=new k(new K(5,3.2),new Me({color:1843240,roughness:.95}));u.position.set(0,1.6,ve),u.receiveShadow=!0,v.add(u);const _=new ft(5,10,2765120,2304567);_.rotation.x=Math.PI/2,_.position.set(0,1.6,ve+.005),v.add(_),a.add(v);const L=(()=>{const c=new B,g=3.05,f=-7,d=.225,m=f-.15,x=new Me({color:2830134,roughness:.6,metalness:.3}),b=new k(new mt(1.8,1.05,.03),new Me({color:15594231,roughness:.25,metalness:.05,transparent:!0,opacity:.55}));b.position.set(0,g+.375,m-.015),b.castShadow=!0,c.add(b);const U=new gt(new _i(new mt(.59,.45,.001)),new vt({color:15229482}));U.position.set(0,g+.19,m+.02),c.add(U);const O=new k(new wi(d,.014,10,28),new Me({color:15229482,roughness:.4,metalness:.5}));O.rotation.x=Math.PI/2,O.position.set(0,g,f),O.castShadow=!0,c.add(O);const E=12,H=.4,W=.09,G=(N,Kt)=>Array.from({length:E},(na,Xt)=>{const nt=Xt/E*Math.PI*2;return new S(Math.cos(nt)*N,Kt,f+Math.sin(nt)*N)}),de=G(d,g),fe=G((d+W)/2,g-H*.5),se=G(W,g-H),Be=[];for(let N=0;N<E;N++)Be.push(de[N],fe[N],fe[N],se[N]);for(let N=0;N<E;N++)Be.push(fe[N],fe[(N+1)%E],se[N],se[(N+1)%E]);const jt=new gt(new He().setFromPoints(Be),new vt({color:16119280,transparent:!0,opacity:.75}));c.add(jt);const je=new k(new _t(.05,.06,b.position.y+.4,12),x);je.position.set(0,(b.position.y+.4)/2,m-.35),je.castShadow=!0,c.add(je);const Ke=new k(new _t(.035,.035,.36,10),x);return Ke.rotation.x=Math.PI/2,Ke.position.set(0,b.position.y,m-.18),c.add(Ke),c.visible=!1,c.name="hoop",a.add(c),c})();let R=null;function F(){L.visible=R==="basketball"&&["court","court_tile","court_gray","court_black"].includes(Pe)}const C=new xi,M={},$="./";function ye(c,g,f){return new Promise(d=>{C.load(`${$}tex/${c}`,m=>{m.wrapS=m.wrapT=re,m.repeat.set(g,f),m.anisotropy=i,m.colorSpace=Z,d(m)})})}async function J(c){if(M[c])return M[c];if(c==="grass")M.grass=await ye("grass.jpg",60,60);else if(c==="paving")M.paving=await ye("paving.jpg",50,50);else if(c==="plaster")M.plaster=await ye("plaster.jpg",2.5,1.6);else if(c==="court_tile"){const g=document.createElement("canvas");g.width=g.height=512;const f=g.getContext("2d"),d=128;f.fillStyle="#DCDEDF",f.fillRect(0,0,512,512);for(let x=0;x<4;x++)for(let b=0;b<4;b++){const U=b*d,O=x*d,E=(b*7+x*13)%5/5;f.fillStyle=`rgb(${214+E*10|0},${217+E*10|0},${219+E*10|0})`,f.fillRect(U,O,d,d),f.strokeStyle="rgba(150,156,161,0.5)",f.lineWidth=2,f.strokeRect(U+1,O+1,d-2,d-2),f.strokeStyle="rgba(156,163,169,0.62)",f.lineWidth=1.1;const H=d/4;for(let W=0;W<4;W++)for(let G=0;G<4;G++){const de=U+W*H,fe=O+G*H;for(let se=0;se<2;se++)f.beginPath(),f.roundRect(de+4+se*13,fe+5,11,H-10,3.5),f.stroke()}}const m=new j(g);m.wrapS=m.wrapT=re,m.repeat.set(120,120),m.anisotropy=i,m.colorSpace=Z,M.court_tile=m}else if(c==="ivorywood"){const g=document.createElement("canvas");g.width=g.height=512;const f=g.getContext("2d"),d=(()=>{let b=11;return()=>(b=b*16807%2147483647)/2147483647})(),m=74;for(let b=0;b*m<512+m;b++){const U=b%2*190;for(let O=-1;O<3;O++){const E=O*380+U,H=b*m,W=.962+d()*.072;f.fillStyle=`rgb(${Math.min(255,236*W)|0}, ${Math.min(255,230*W)|0}, ${Math.min(255,222*W)|0})`,f.fillRect(E,H,380,m),f.strokeStyle="rgba(196,186,170,0.34)",f.lineWidth=1.4,f.strokeRect(E+.7,H+.7,380-1.4,m-1.4),f.strokeStyle="rgba(204,195,180,0.20)",f.lineWidth=1;for(let G=0;G<3;G++){const de=H+12+d()*(m-24);f.beginPath(),f.moveTo(E+8,de),f.lineTo(E+372,de+(d()-.5)*5),f.stroke()}}}const x=new j(g);x.wrapS=x.wrapT=re,x.repeat.set(46,46),x.anisotropy=i,x.colorSpace=Z,M.ivorywood=x}else if(c==="track"){const g=await new Promise(x=>{const b=new Image;b.onload=()=>x(b),b.src=`${$}tex/asphalt.jpg`}),f=document.createElement("canvas");f.width=f.height=512;const d=f.getContext("2d");d.fillStyle="#B7C6AA",d.fillRect(0,0,512,512),d.globalAlpha=.34,d.globalCompositeOperation="overlay",d.drawImage(g,0,0,512,512),d.globalAlpha=.12,d.globalCompositeOperation="saturation",d.fillStyle="#808080",d.fillRect(0,0,512,512),d.globalAlpha=1,d.globalCompositeOperation="source-over",d.fillStyle="rgba(248,248,244,0.85)",d.fillRect(96,0,7,512),d.fillRect(409,0,7,512);const m=new j(f);m.wrapS=m.wrapT=re,m.repeat.set(60,60),m.anisotropy=i,m.colorSpace=Z,M.track=m}else if(c==="dirt"){const g=await new Promise(x=>{const b=new Image;b.onload=()=>x(b),b.src=`${$}tex/asphalt.jpg`}),f=document.createElement("canvas");f.width=f.height=512;const d=f.getContext("2d");d.fillStyle="#C4BBA4",d.fillRect(0,0,512,512),d.globalAlpha=.4,d.globalCompositeOperation="overlay",d.drawImage(g,0,0,512,512),d.globalAlpha=.16,d.globalCompositeOperation="saturation",d.fillStyle="#808080",d.fillRect(0,0,512,512),d.globalAlpha=1,d.globalCompositeOperation="source-over",d.strokeStyle="rgba(120,110,92,0.35)",d.lineWidth=2,d.beginPath(),d.moveTo(0,256),d.lineTo(512,262),d.moveTo(256,0),d.lineTo(250,512),d.stroke();const m=new j(f);m.wrapS=m.wrapT=re,m.repeat.set(24,24),m.anisotropy=i,m.colorSpace=Z,M.dirt=m}else if(c==="indoorwood"){const g=document.createElement("canvas");g.width=g.height=512;const f=g.getContext("2d"),d=(()=>{let x=7;return()=>(x=x*16807%2147483647)/2147483647})();for(let x=0;x<8;x++){const b=x%2*128;for(let U=-1;U<3;U++){const O=U*256+b,E=x*64,H=.82+d()*.3;f.fillStyle=`rgb(${Math.round(168*H)}, ${Math.round(126*H)}, ${Math.round(84*H)})`,f.fillRect(O,E,256,64),f.strokeStyle="rgba(70,48,30,0.55)",f.lineWidth=2,f.strokeRect(O+1,E+1,254,62),f.strokeStyle="rgba(90,62,40,0.25)",f.lineWidth=1;for(let W=0;W<4;W++){const G=E+10+d()*46;f.beginPath(),f.moveTo(O+6,G),f.lineTo(O+250,G+(d()-.5)*6),f.stroke()}}}const m=new j(g);m.wrapS=m.wrapT=re,m.repeat.set(26,26),m.anisotropy=i,m.colorSpace=Z,M.indoorwood=m}else if(c==="wallpaper"){const g=document.createElement("canvas");g.width=g.height=256;const f=g.getContext("2d");f.fillStyle="#F6F5F2",f.fillRect(0,0,256,256);const d=(()=>{let x=13;return()=>(x=x*16807%2147483647)/2147483647})();for(let x=0;x<256;x+=2){const b=.02+d()*.045;f.fillStyle=d()<.5?`rgba(208,205,198,${b})`:`rgba(255,255,255,${b})`,f.fillRect(x,0,1+d()*1.5,256)}for(let x=0;x<90;x++)f.fillStyle=`rgba(196,188,174,${.03+d()*.04})`,f.fillRect(d()*256,d()*256,1,3+d()*9);const m=new j(g);m.wrapS=m.wrapT=re,m.repeat.set(9,5),m.anisotropy=i,m.colorSpace=Z,M.wallpaper=m}return M[c]}let Fe=0,Pe=null;function it(){return Pe==="indoor"?15723490:!Pe||Pe==="none"?8291727:12173514}function at(){if(!I)return;const c=it();a.background.setHex(c),a.fog.color.setHex(c)}let X=null,V=null;async function Nt(c){const g=++Fe;if(Pe=!c||c==="none"?null:c,!c||c==="none"){p.material.map=null,p.material.color.setHex(I?6712438:1514016),u.material.map=null,u.material.color.setHex(I?7765126:1843240),u.material.emissive?.setHex(0),p.material.needsUpdate=!0,u.material.needsUpdate=!0,r.visible=!0,_.visible=!0,X&&(X.visible=!1),V&&(V.visible=!1),F(),at();return}const f=c==="court_gray"||c==="court_black",d=c==="indoor"?"ivorywood":c==="court"?"indoorwood":c,[m,x]=await Promise.all([f?null:J(d),J("plaster")]);if(g===Fe){if(!X){const U=new Q({uniforms:{uColor:{value:new he(16448245)},uOpacity:{value:.85},uHalf:{value:.025}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`
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
          }`,transparent:!0,depthWrite:!1});X=new k(new K(16,16),U),X.rotation.x=-Math.PI/2,X.position.y=.006,X.renderOrder=1,X.name="courtLines",a.add(X)}if(!V){const b=new Q({uniforms:{uTint:{value:new he(11975358)},uOut:{value:.5},uKey:{value:.22}},vertexShader:"varying vec2 vUv; void main(){ vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }",fragmentShader:`
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
          }`,transparent:!0,depthWrite:!1});V=new k(new K(60,60),b),V.rotation.x=-Math.PI/2,V.position.y=.005,V.renderOrder=0,V.name="courtZones",a.add(V)}if(V.visible=c==="court_tile",X.visible=c==="court"||c==="court_tile"||f,p.material.map=f?null:m,u.material.map=x,f)p.material.color.setHex(c==="court_black"?2502721:2830912),p.material.roughness=c==="court_black"?.42:.6,p.material.metalness=c==="court_black"?.22:.12,u.material.map=await J("wallpaper"),u.material.color.setHex(16777215),u.material.emissive?.setHex(I?7236195:5722955);else if(c==="court_tile"||c==="track"){const b=c==="court_tile";p.material.roughness=b?.78:.92,p.material.metalness=b?.04:.05,p.material.color.setHex(I?14474975:12567753),u.material.map=await J("wallpaper"),u.material.color.setHex(16777215),u.material.emissive?.setHex(I?7236195:5722955)}else c==="indoor"||c==="court"?(p.material.roughness=.92,p.material.metalness=.05,p.material.color.setHex(c==="indoor"?I?16249577:14209218:I?16183784:14209218),u.material.map=await J("wallpaper"),u.material.color.setHex(16777215),u.material.emissive?.setHex(I?7236195:5722955)):(u.material.emissive?.setHex(0),p.material.roughness=.92,p.material.metalness=.05,p.material.color.setHex(I?14408667:9079434),u.material.color.setHex(I?14869218:10132122));p.material.needsUpdate=!0,u.material.needsUpdate=!0,r.visible=!1,_.visible=!1,F(),at()}}const st={running:{pos:[2.9,2.1,2.9],look:[0,.7,-.6]},boxing:{pos:[3.5,1.9,3.9],look:[0,1.1,-.1]},basketball:{pos:[3.4,2.6,2.6],look:[0,.6,-1]}};function It(c){const g=st[c]||st.running;o.position.set(...g.pos),s.target.set(...g.look),s.update()}function Ut(c,g){v.visible=!!g,R=c,F(),It(c)}const ce=a.children.find(c=>c.isHemisphereLight);let I=!1;function Ht(c){if(I=!!c,D.day=I,I){const g=it();a.background.setHex(g),a.fog.color.setHex(g),a.fog.near=14,a.fog.far=40,ce.color.setHex(14476526),ce.groundColor.setHex(8291468),ce.intensity=1.1,l.intensity=1.6,l.color.setHex(16774112),h.intensity=.12,p.material.map||p.material.color.setHex(6712438),u.material.map||u.material.color.setHex(7765126),p.material.map&&p.material.color.setHex(14408667),u.material.map&&u.material.color.setHex(14869218)}else a.background.setHex(790034),a.fog.color.setHex(790034),a.fog.near=9,a.fog.far=20,ce.color.setHex(3752527),ce.groundColor.setHex(1119258),ce.intensity=1.1,l.intensity=1.5,l.color.setHex(16777215),h.intensity=.35,p.material.map||p.material.color.setHex(1514016),u.material.map||u.material.color.setHex(1843240),p.material.map&&p.material.color.setHex(9079434),u.material.map&&u.material.color.setHex(10132122);p.material.needsUpdate=!0,u.material.needsUpdate=!0}const ee=new Pt(t),Ge=new ji(a,o);ee.addPass(Ge),ee.addPass(new ke({uniforms:{tDiffuse:{value:null}},vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"uniform sampler2D tDiffuse;varying vec2 vUv;void main(){vec4 c=texture2D(tDiffuse,vUv);if(c.r!=c.r||c.g!=c.g||c.b!=c.b||c.a!=c.a)c=vec4(0.0);gl_FragColor=clamp(c,0.0,60.0);}"}));const Te=new be(new T(n.clientWidth/2,n.clientHeight/2),D.bloomStrength,D.bloomRadius,D.bloomThreshold);ee.addPass(Te),ee.renderToScreen=!1;const pe=new Pt(t);pe.addPass(Ge);const ot=new ke({uniforms:{tDiffuse:{value:null},tBloom:{value:ee.renderTarget2.texture},uInkAlpha:{value:0}},vertexShader:"varying vec2 vUv;void main(){vUv=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}",fragmentShader:"uniform sampler2D tDiffuse,tBloom;uniform float uInkAlpha;varying vec2 vUv;void main(){vec4 s=texture2D(tDiffuse,vUv),b=texture2D(tBloom,vUv);gl_FragColor=vec4(s.rgb+b.rgb, mix(s.a+b.a, s.a, uInkAlpha));}"});pe.addPass(ot);const te=new ke(Vi);pe.addPass(te),pe.addPass(new Xi);const Ce=[];function zt(){Ce.length=0,a.traverse(c=>{c.visible&&c.material?._noBloom&&(c.visible=!1,Ce.push(c))})}function Wt(){for(const c of Ce)c.visible=!0;Ce.length=0}function Gt(c){Te.threshold=D.bloomThreshold+(D.day?.38:0),Te.strength=D.bloomStrength,Te.radius=D.bloomRadius,te.uniforms.uGrain.value=D.grain,te.uniforms.uVignette.value=D.vignette,te.uniforms.uExposure.value=D.exposure,te.uniforms.uTime.value=c,te.uniforms.uAlphaOut.value=D.alphaOut?1:0,te.uniforms.uAlphaFloor.value=D.alphaFloor||0,te.uniforms.uAlphaGamma.value=D.alphaGamma||1,ot.uniforms.uInkAlpha.value=D.inkAlpha?1:0,zt(),ee.render(),Wt(),pe.render()}function rt(){t.domElement.style.width="0px",t.domElement.style.height="0px";const c=n.clientWidth,g=n.clientHeight;o.aspect=c/g,o.updateProjectionMatrix(),t.setSize(c,g),ee.setSize(c,g),pe.setSize(c,g),Te.setSize(c/2,g/2)}window.addEventListener("resize",rt);function Bt(c){const g=Math.round(c/2)*2;p.position.z=g,r.position.z=g}return{renderer:t,scene:a,camera:o,controls:s,setPackEnvironment:Ut,resize:rt,renderFrame:Gt,composer:ee,setSurfaces:Nt,setDaylight:Ht,followFloor:Bt,wall:u,wallGroup:v,hoop:L,setRenderCamera:c=>{Ge.camera=c}}}const Lt=`
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
}`,Yi=`
uniform float uHT, uHTPitch, uHTGain, uHTSoft, uHTWave, uHTGlow, uHTInner;
uniform sampler2D uNumTex; uniform float uNumOn, uNumScale; uniform vec2 uNumOff;   // 하프톤 스킨 — 후보랩 확정본
#include <common>
#include <clipping_planes_pars_fragment>
`+Rt+`
uniform float uW, uHalo, uNoise;
`+Vt+`
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
}`,Zi=`
#include <common>
#include <clipping_planes_pars_fragment>
`+Rt+`
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
}`,Qi={solid:0,dash:1,dot:2,chevron:3,comet:4,taper:5},Y={ox:0,oz:0,fx:0,fz:-1,rx:1,rz:0,halfL:0,halfW:0,feather:.3,amt:0};function qi(n){const e=new Q({vertexShader:Lt,fragmentShader:Zi,uniforms:{uLUT:{value:De()},uTime:{value:0},uLen:{value:n},uW:{value:1},uHalo:{value:.9},uGain:{value:1},uLStyle:{value:1},uLSpeed:{value:1},uLGap:{value:1},uLHeat:{value:.5},uLTail:{value:.55},uDay:{value:0},uOut:{value:1},uFPOrigin:{value:new S},uFPFwd:{value:new S(0,0,-1)},uFPRight:{value:new S(1,0,0)},uFPNear:{value:-1e6},uFPFar:{value:1e6},uFPHalfN:{value:1e6},uFPHalfF:{value:1e6},uFPFadeM:{value:.15}},transparent:!0,blending:ue,depthWrite:!1,side:$e});return e.clipping=!0,e._src="LANEFX",e}const ne=Qe/qe,q={core:w.w,halo:w.halo,pool:w.pool,sweep:.4,wobble:w.noise};if(w.prims){y.prims=y.prims||{};for(const n in w.prims)y.prims[n]={...y.prims[n]||{},...w.prims[n]}}y.primBloom=w.bloom;function $i(n=null){const e=new Q({vertexShader:Lt,fragmentShader:Yi,uniforms:{uLUT:{value:De()},uUIOrigin:{value:new S},uUIFwd:{value:new S(0,0,-1)},uUIRight:{value:new S(1,0,0)},uUIHalfL:{value:0},uUIHalfW:{value:0},uUIFeather:{value:.3},uUIAmt:{value:0},uShape:{value:n?1:0},uRadius:{value:n?1:1.5652173913043477},uSDF2:{value:n||De()},uSDFWarn:{value:bi()||De()},uImp:{value:n?w.imp:0},uImpPitch:{value:w.pitch*ne},uImpDot:{value:w.dot},uImpGlow:{value:w.glow},uImpShade:{value:w.shade},uImpSharp:{value:w.sharp},uImpShadeCol:{value:w.shadeCol},uImpEdge:{value:w.edge*ne},uImpScale:{value:w.scale},uImpRot:{value:(n?._right?-5.5:w.irot)*Math.PI/180},uImpCtr:{value:new T(n?(n._inCx??.5)*2-1:0,n?1-(n._inCy??.5)*2:0)},uImpOff:{value:new T((n?._right?.043:w.offx)*ne,w.offy*ne)},uRip:{value:w.rip},uRipSpeed:{value:w.ripSpeed},uRipWidth:{value:w.ripWidth*ne},uRipReach:{value:w.ripReach*ne},uEdgeShade:{value:w.edgeShade},uEdgeW:{value:w.edgeW*ne},uEdgeSoft:{value:w.edgeSoft},uEdgeShadeW:{value:w.edgeShadeW},uEdgeShadeCol:{value:w.edgeShadeCol},uIceOld:{value:0},uStatePrev:{value:0},uPrevProg:{value:0},uXfade:{value:1},uEdgeShadeGrad:{value:w.edgeShadeGrad},uEdgeShadeG0:{value:w.edgeShadeG0},uEdgeShadeG1:{value:w.edgeShadeG1},uShadeRed:{value:w.shadeRed},uShadeRedW:{value:w.shadeRedW},uDither:{value:w.dither},uSilFit:{value:Qe/qe},uPlantar:{value:w.plantar},uBands:{value:w.bands},uBandSoft:{value:w.bandSoft},uRipGrad:{value:w.ripGrad},uRipCol:{value:w.ripCol},uPhase:{value:0},uProg:{value:0},uFade:{value:1},uToe:{value:0},uStrong:{value:0},uContract:{value:0},uTime:{value:0},uSeed:{value:Math.random()*6.2832},uW:{value:1},uHalo:{value:.9},uPool:{value:.55},uGain:{value:1},uSweepA:{value:1},uNoise:{value:.5},uDay:{value:0},uOut:{value:1},uHT:{value:0},uHTPitch:{value:.055},uHTGain:{value:1.15},uHTSoft:{value:.55},uHTWave:{value:.6},uHTGlow:{value:0},uHTInner:{value:0},uNumTex:{value:null},uNumOn:{value:0},uNumScale:{value:.311},uNumOff:{value:new T},uFPOrigin:{value:new S},uFPFwd:{value:new S(0,0,-1)},uFPRight:{value:new S(1,0,0)},uFPNear:{value:-1e6},uFPFar:{value:1e6},uFPHalfN:{value:1e6},uFPHalfF:{value:1e6},uFPFadeM:{value:.28}},transparent:!0,blending:ue,depthWrite:!1,side:$e});return e.clipping=!0,e._src=n?"MARKFX(발형)":"MARKFX(존원)",e._noBloom=!0,Dt.push(e),e}const Dt=[];function ca(n={}){const e=Qe/qe,t={imp:"uImp",dot:"uImpDot",glow:"uImpGlow",shade:"uImpShade",sharp:"uImpSharp",shadeCol:"uImpShadeCol",scale:"uImpScale",plantar:"uPlantar",bands:"uBands",bandSoft:"uBandSoft",edgeShade:"uEdgeShade",edgeShadeW:"uEdgeShadeW",edgeShadeCol:"uEdgeShadeCol",edgeShadeGrad:"uEdgeShadeGrad",edgeShadeG0:"uEdgeShadeG0",edgeShadeG1:"uEdgeShadeG1",shadeRed:"uShadeRed",shadeRedW:"uShadeRedW",edgeSoft:"uEdgeSoft",dither:"uDither",rip:"uRip",ripSpeed:"uRipSpeed",ripGrad:"uRipGrad",ripCol:"uRipCol",iceOld:"uIceOld"},i={pitch:"uImpPitch",edge:"uImpEdge",edgeW:"uEdgeW",ripWidth:"uRipWidth",ripReach:"uRipReach"};for(const a of Dt){const o=a.uniforms,s=o.uShape?.value===1;for(const l in t)n[l]==null||!o[t[l]]||l==="imp"&&!s||(o[t[l]].value=n[l]);for(const l in i)n[l]!=null&&o[i[l]]&&(o[i[l]].value=n[l]*e)}if(n.halo!=null&&(y.mark.halo=n.halo),n.w!=null&&(y.mark.core=n.w,y.arrow&&(y.arrow.w=n.w)),n.w!=null&&(q.core=n.w),n.halo!=null&&(q.halo=n.halo),n.pool!=null&&(q.pool=n.pool),n.noise!=null&&(q.wobble=n.noise),n.bloom!=null&&(y.primBloom=n.bloom),n.prims){y.prims=y.prims||{};for(const a in n.prims)y.prims[a]={...y.prims[a]||{},...n.prims[a]}}}const ae={left:oe.red,right:oe.red,target:oe.red,guide:oe.coral,lane:oe.red,success:oe.prism,user:oe.prism},Ot=[1,.75,.55,.38],Ji=typeof location>"u"||new URLSearchParams(location.search).get("xfade")!=="0",ea=[1,.78,.58,.42];let We=!1;function pa(n){We=!!n}const Ze=.3,ta=.727,Tt=Ze/ta,Ve={base:Ze*.65,loose:Ze*1},_e={markScale:1,fillOpacity:.2,previewEdge:.5,cdContractFrom:1.9,cdGain:.6,lingerEdge:.9,linger:.35};_e.linger;const ia={running:{mode:"advance",V:2.5,STRIKE_AHEAD:.15,X_SCALE:2,LANE_W:1.6,CAL:{right:{x:-.187,z:.049},left:{x:.128,z:0}}},boxing:{mode:"static",FLOOR_SCALE:1.6,WALL:{XS:2.2,Y0:.73,YS:1.2}},basketball:{mode:"spatial",SCALE:5}},da=5,Ye={},me=new Image;me.src="./ready-view/assets/pace_foot.svg";function aa(n){const e=n?"R":"L";if(Ye[e])return Ye[e];const t=document.createElement("canvas");t.width=t.height=128;const i=t.getContext("2d"),a=me.complete&&me.naturalWidth;if(a){const s=document.createElement("canvas");s.width=s.height=128;const l=s.getContext("2d"),h=me.naturalWidth/me.naturalHeight,p=100,r=p/h;l.save(),n&&(l.translate(128,0),l.scale(-1,1)),l.drawImage(me,(128-p)/2,(128-r)/2,p,r),l.restore(),l.globalCompositeOperation="source-in",l.fillStyle=le(Ue.ink,.95),l.fillRect(0,0,128,128),i.shadowColor=le(Ie.coral,.75),i.shadowBlur=12,i.drawImage(s,0,0),i.shadowBlur=0,i.drawImage(s,0,0)}else i.strokeStyle=le(Ue.ink,.95),i.lineWidth=5,i.shadowColor=le(Ie.coral,.75),i.shadowBlur=12,i.beginPath(),i.ellipse(64,64,20,34,n?.12:-.12,0,Math.PI*2),i.stroke();const o=new j(t);return o.colorSpace=Z,o.anisotropy=4,a&&(Ye[e]=o),o}function kt(n){const e=document.createElement("canvas");e.width=e.height=128;const t=e.getContext("2d");Et(t,String(n),64,64,96)||(t.fillStyle=le(Ue.ink,.95),t.font="300 86px -apple-system, sans-serif",t.textAlign="center",t.textBaseline="middle",t.shadowColor=le(Ie.coral,.75),t.shadowBlur=14,t.fillText(String(n),64,70));const i=new j(e);return i.anisotropy=4,i}function sa(n){const i=document.createElement("canvas");i.width=4,i.height=4;let a=i.getContext("2d");a.font="400 56px -apple-system, 'Apple SD Gothic Neo', sans-serif";const o=Math.ceil(a.measureText(n).width);i.width=o+40,i.height=56*1.7,a=i.getContext("2d"),a.font="400 56px -apple-system, 'Apple SD Gothic Neo', sans-serif",a.textAlign="center",a.textBaseline="middle",a.shadowColor=le(Ie.coral,.7),a.shadowBlur=56*.25,a.fillStyle=Ue.ink,a.fillText(n,i.width/2,i.height/2);const s=new j(i);return s.colorSpace=Z,s.anisotropy=8,{tex:s,aspect:i.width/i.height}}function oa(n){const e=document.createElement("canvas");e.width=e.height=256;const t=e.getContext("2d"),i="#"+n.toString(16).padStart(6,"0");return t.strokeStyle=i,t.lineWidth=12,t.lineCap="butt",t.setLineDash([26,20]),t.beginPath(),t.arc(128,128,104,0,Math.PI*2),t.stroke(),new j(e)}class Mt{constructor(e,t,i,a=!1){this._footRight=a,this.group=new B,this.radius=e,this.color=t,this.surface=i,this.num=null;let o=null;if(i==="floor"&&y.markShape===1)try{o=yi(this._footRight===!0)}catch{o=null}this._isFoot=!!o;const s=(this._isFoot?Tt:e*2.78)*lt;this.fx=new k(new K(s,s),$i(o)),this.fx.position.z=.002,this._baseGain=i==="wall"?.6:1,this.fx.material.uniforms.uGain.value=this._baseGain,this.group.add(this.fx),i==="floor"&&(this.group.rotation.x=-Math.PI/2,this.group.position.y=.012),this.group.renderOrder=5}setSelected(e){if(e&&!this.sel){this.sel=new B;const t=(i,a,o,s,l)=>{const h=new k(new Ti(i,a,48),new xe({color:o,transparent:!0,opacity:s,depthWrite:!1,side:$e}));return h.renderOrder=l,h};this.sel.add(t(this.radius*1.44,this.radius*1.58,790034,.85,6)),this.sel.add(t(this.radius*1.32,this.radius*1.44,16777215,.95,7)),this.sel.position.z=.005,this.group.add(this.sel)}this.sel&&(this.sel.visible=!!e)}setNumber(e){this._numN=e;const t=new xe({map:kt(e),transparent:!0,depthWrite:!1}),i=this.radius*2.78*ht.RATIO/.75*(this._isFoot?1:Yt);this.num=new k(new K(i,i),t),this.num.position.z=.004;const a=this.fx?.material?.uniforms;a?.uNumTex&&(a.uNumTex.value=t.map,a.uNumScale.value=i/(this.radius*2.78)),this.group.add(this.num)}setContract(e="reach"){this.contract=e,this.fx.material.uniforms.uContract.value=e==="avoid"?1:0}render(e,t,i,a){const o=this.group;if(e==="hidden"){o.visible=!1,this._lastPhase="hidden";return}o.visible=!0;const s=performance.now()/1e3;e!==this._lastPhase&&((this._lastPhase==="hidden"||this._lastPhase==null)&&(e==="preview"||e==="countdown")&&(this._spawnT=s),e==="linger"&&(this._hitT=s),this._lastPhase=e);let l=1;if(this._spawnT!=null){const r=(s-this._spawnT)/.38;if(r<1){const v=1-Math.pow(1-r,3);l*=.55+.45*v+.1*Math.sin(Math.min(1,r)*Math.PI)}}if(this._hitT!=null){const r=(s-this._hitT)/.3;r<1&&(l*=1+.3*(1-r)*(1-r))}o.scale.setScalar(a*_e.markScale*l);const h=We?ea:Ot,p=h[Math.min(i,h.length-1)];if(this.fx.visible){const r=this.fx.material.uniforms;r.uTime.value=performance.now()/1e3;const v=e==="preview"?0:e==="countdown"?1:e==="locked"?3:e==="miss"?4:2;if(r.uPhase.value!==v&&Ji&&(r.uStatePrev.value=r.uPhase.value,r.uPrevProg.value=r.uProg.value,this._xfT=s),r.uPhase.value=v,this._xfT!=null){const L=(s-this._xfT)/.28;r.uXfade.value=L>=1?1:L,L>=1&&(this._xfT=null)}r.uProg.value=t,r.uFade.value=p,r.uStrong.value=this.strongPreview?1:0,r.uW.value=q.core,r.uHalo.value=q.halo,r.uPool.value=q.pool,r.uSweepA.value=q.sweep,r.uNoise.value=q.wobble,r.uUIAmt&&(r.uUIOrigin.value.set(Y.ox,0,Y.oz),r.uUIFwd.value.set(Y.fx,0,Y.fz),r.uUIRight.value.set(Y.rx,0,Y.rz),r.uUIHalfL.value=Y.halfL,r.uUIHalfW.value=Y.halfW,r.uUIFeather.value=Y.feather,r.uUIAmt.value=this.surface==="wall"?0:Y.amt);const u=e==="linger"?1+.9*Math.max(0,1-t*2.2):1;r.uGain.value=this._baseGain*y.gainBoost*(We?1.35:1)*u;const _=y.day||y.markBlend==="ink"?1:0;r.uDay.value!==_&&(r.uDay.value=_,this.fx.material.blending=_?Je:ue,this.fx.material.needsUpdate=!0)}if(this.num&&(this.num.material.opacity=y.hideOrderNums&&!this._numFoot?0:e==="preview"?(this.strongPreview?1:.5)*p:e==="countdown"?1:e==="linger"?.4*(1-t):e==="locked"?.48*p:e==="miss"?.3*(1-t):1),this.num&&this.fx?.material?.uniforms?.uHT){const r=this.fx.material.uniforms,v=r.uHT.value>.5;r.uNumOn.value=v&&this.num.material.opacity>.01?1:0,r.uNumOff.value.set(this.num.position.x/(this.radius*1.39),this.num.position.y/(this.radius*1.39)),v?this.num.visible=!1:this.num.visible||(this.num.visible=!0)}if(this.num&&this._isFoot&&y.numFoot){const r=y.numFoot,v=r[y.footCtx==="in"?"in":"out"]||r.L||(r.R?{x:1-r.R.x,y:r.R.y,s:r.R.s}:null);if(v){const u=ht.anchor(v,this._footRight,Tt*lt);this.num.position.set(u.x,u.y,.004),this.num.scale.setScalar(u.s)}}}}const Ne=[];function Ft(n,{tips:e=1,wall:t=!1,scale:i=1}={}){const a=new B,o=document.createElement("canvas");o.width=128,o.height=256;const s=new j(o);s.colorSpace=Z,s.anisotropy=4;const l=new k(new K(n*.5,n),new xe({map:s,transparent:!0,depthWrite:!1,blending:ue}));return l.position.y=n/2,a.add(l),a._len=n,a._canvas=o,a._tex=s,a._mesh=l,a._paintT=-9,a._noTip=e===0,a._tips=[],a._scale=i,t?(a.rotation.x=0,a.position.y=0):(a.rotation.x=-Math.PI/2,a.position.y=.014),a.renderOrder=6,a._wall=!!t,Ne.push(a),a}function ra(n,e,t=0){const i=n?._fp;if(!i)return 1;const a=(u,_,L)=>{const R=Math.max(0,Math.min(1,(L-u)/(_-u)));return R*R*(3-2*R)},o=.25+t,s=e.x-i.ox,l=e.z-i.oz,h=s*i.fx+l*i.fz,p=s*i.rx+l*i.rz,r=Math.max(0,Math.min(1,(h-n.fpNear)/Math.max(.01,n.fpFar-n.fpNear))),v=n._halfAt(n.fpNear)+(n._halfAt(n.fpFar)-n._halfAt(n.fpNear))*r;return a(n.fpNear,n.fpNear+o,h)*a(n.fpFar,n.fpFar-o,h)*a(v,v-o,Math.abs(p))}function fa(n,e){ie.map.TIP_TRI||(ie.map.TIP_TRI="./ready-view/assets/arrow_tip.svg",ie.set(ie.map)),ie.map.LIFT_TIP||(ie.map.LIFT_TIP="./ready-view/assets/lift_tip.svg",ie.set(ie.map));const t=y.day||y.markBlend==="ink"?1:0,i={lut:Pi,glyph:Et,arrow:y.arrow||{}};for(let a=Ne.length-1;a>=0;a--){const o=Ne[a];if(!o.parent){Ne.splice(a,1);continue}n-o._paintT>=1/24&&(o._paintT=n,Zt(o._canvas.getContext("2d"),128,256,n,i,{noTip:o._noTip,prog:o._prog,scale:o._scale}),o._tex.needsUpdate=!0);const s=e?._fp,l=o._mesh.material;if(s&&!o._wall){const h=v=>ra(e,v),p=new S,r=new S;o.getWorldPosition(p),o._mesh.getWorldPosition(r),r.multiplyScalar(2).sub(p),l.opacity=Math.min(h(p),h(r))*(o._gain??1)}else l.opacity=o._gain??1;l._day!==t&&(l._day=t,l.blending=t?Je:ue,l.needsUpdate=!0)}}class ma{constructor(e,t){this.scene=e,this.effects=t,this.params={lead:.7,size:1,maxVisible:3},this.root=new B,e.add(this.root),this.floorRoot=new B,this.wallRoot=new B,this.root.add(this.floorRoot,this.wallRoot),this.events=[],this.ambient=[],this.pack=null,this.layout=null,this.duration=0,this.onEvent=null,this.footprintTest=null,this.gazeTest=null,this.stats={inGaze:0,total:0},this.floorClip=null,this.wallClip=null}_applyClip(e,t){t&&e.traverse(i=>{i.material&&(i.material.clippingPlanes=t)})}_floorClipFor(){return this.layoutPreview?null:this.floorClip}setCompare(e){if(this._compareRoot){for(const s of this._compareRoot)s.removeFromParent();this._compareRoot=null}if(!e||!this.pack||e.sport!==this.pack.sport)return;const t=new B,i=new B,a=oa(10134445),o=()=>new xe({map:a,transparent:!0,opacity:.5,depthWrite:!1});for(const s of e.tokens)if(s.type==="stepMark"){const l=this._mapFloor(s),h=new k(new K(.4,.4),o());h.rotation.x=-Math.PI/2,h.position.set(l.x,.011,l.z),h.renderOrder=3,this._applyClip(h,this._floorClipFor()),t.add(h)}else if(s.type==="targetMark"&&this.pack.hasWall){const l=this._mapWall(s),h=new k(new K(.34,.34),o());h.position.set(l.x,l.y,l.z-.005),h.renderOrder=3,this._applyClip(h,this.wallClip),i.add(h)}this.floorRoot.add(t),this.wallRoot.add(i),this._compareRoot=[t,i]}recolor(){for(const e of this.events)if(e.marker){const t=ae[e.marker.role]??ae.left;e.marker.color=t,e.color=t}}setParams(e){Object.assign(this.params,e)}setPack(e){this.floorRoot.clear(),this.wallRoot.clear(),this._compareRoot=null,this.laneFX=null,this.floorRoot.position.set(0,0,0),this.events=[],this.ambient=[],this.pack=e,this.layout=ia[e.sport],this.duration=e.duration;const t=this.layout,i=new Map;for(const o of e.tokens){if(o.type==="pathLane"||o.lifetime>=e.duration*.85){this.ambient.push(o);continue}const l=Math.round(o.t*1e3);i.has(l)||i.set(l,{t:o.t,tokens:[]}),i.get(l).tokens.push(o)}const a=e.sport==="boxing";for(const o of[...i.values()].sort((s,l)=>s.t-l.t)){const s={t:o.t,fired:!1,marker:null,arrow:null,surface:"floor",pos:new S,color:16777215,foot:null};let l=null;for(const h of o.tokens)if(!(a&&(h.type==="orderPulse"&&(l=h.n),h.type!=="targetMark"))){if(h.type==="stepMark"||h.type==="targetMark"||h.type==="orderPulse"&&!s.marker){const p=h.type==="targetMark"&&this.pack.hasWall,r=h.type==="targetMark"?ae.target:ae[h.foot]??ae.left,v=h.radiusCm?h.radiusCm/100:h.type==="targetMark"?Ve.loose:Ve.base,u=new Mt(v,r,p?"wall":"floor",h.foot==="right");!p&&(h.contract&&h.contract!=="reach"||h.holdRing)&&u.setContract(h.contract),u.role=h.type==="targetMark"?"target":h.foot??"left",s.marker=u,s.surface=p?"wall":"floor",s.color=r,s.foot=h.foot??null,s.srcToken=h,(p?this.wallRoot:this.floorRoot).add(u.group),this._applyClip(u.group,p?this.wallClip:this._floorClipFor())}if(h.type==="orderPulse"&&s.marker&&!s.marker.num&&!s.marker._skipNumber&&s.marker.setNumber(h.n),h.type==="directionGuide"){const p=Ft(e.sport==="basketball"?.9:.55),r=this._mapFloor(h);p.position.x=r.x,p.position.z=r.z,p.rotation.z=Ct.degToRad(-(h.angle??0)),s.arrow={obj:p,t:h.t,lifetime:h.lifetime},this.floorRoot.add(p),this._applyClip(p,this._floorClipFor())}}a&&s.marker&&l!=null&&!s.marker.num&&(s.marker.setNumber(l),this._applyClip(s.marker.group,this.wallClip)),(s.marker||s.arrow)&&this.events.push(s)}if(e.sport==="basketball"){const o=this.events.filter(s=>s.surface==="floor"&&s.marker).sort((s,l)=>s.t-l.t);for(let s=0;s<o.length;s++){const l=o[s],h=o[s+1],p=o[s-1],r=this._mapFloor(l.srcToken);if(l.arrow&&h){const v=this._mapFloor(h.srcToken),u=v.x-r.x,_=v.z-r.z;l.arrow.obj.rotation.z=Math.atan2(-u,-_),l.arrow.obj.position.x=r.x,l.arrow.obj.position.z=r.z}if(p){const v=this._mapFloor(p.srcToken);let u=r.x-v.x,_=r.z-v.z;const L=Math.hypot(u,_)||1;u/=L,_/=L;const R=new B,F=Math.atan2(-u,-_);for(let C=0;C<3;C++){const M=Ft(.5,{tips:0});M.rotation.z=F+Math.PI/2,M.position.set(r.x-u*(.4+C*.24),.011,r.z-_*(.4+C*.24)),M.renderOrder=4,M._gain=.55-C*.13,R.add(M)}l.stripes=R,this.floorRoot.add(R),this._applyClip(R,this._floorClipFor())}}}for(const o of this.ambient)if(o.type==="pathLane"&&this._buildLane(e),o.type==="stepMark"&&!a){const s=new Mt(Ve.base,ae[o.foot]??ae.left,"floor");s.role=o.foot??"left";const l=this._mapFloor(o);s.group.position.x=l.x,s.group.position.z=l.z,s.render("preview",0,0,1),s.isStance=!0,this.floorRoot.add(s.group),this._applyClip(s.group,this._floorClipFor()),this.stanceMarks=this.stanceMarks||[],this.stanceMarks.push(s)}{const o=(e.tokens||[]).filter(l=>l.type==="stepMark"&&l.t!=null).map(l=>l.t).sort((l,h)=>l-h),s=[];for(let l=1;l<o.length;l++){const h=o[l]-o[l-1];h>.05&&s.push(h)}s.sort((l,h)=>l-h),this._beatT=s.length?s[Math.floor(s.length/2)]:0,this._strideM=t.mode==="advance"&&this._beatT?t.V*this._beatT:0}if(a&&this.pack.hasWall){const o=this.events.filter(s=>s.surface==="wall"&&s.marker).sort((s,l)=>s.t-l.t);if(o.forEach((s,l)=>{!s.marker.num&&!s.marker._skipNumber&&s.marker.setNumber(l+1)}),o.length){const s=o.reduce((v,u)=>v+this._mapWall(u.srcToken).y,0)/o.length,l=this.layout.WALL,h=new wt(new He().setFromPoints([new S(-l.XS*.72,s,ve+.012),new S(l.XS*.72,s,ve+.012)]),new xt({color:16696201,dashSize:.05,gapSize:.07,transparent:!0,opacity:.3}));h.computeLineDistances(),this.wallRoot.add(h),this._applyClip(h,this.wallClip);const p=sa(`타깃 ${Math.round(s*100)}cm`),r=new k(new K(p.aspect*.075,.075),new xe({map:p.tex,transparent:!0,opacity:.55,depthWrite:!1}));r.position.set(l.XS*.72-p.aspect*.075/2,s+.065,ve+.012),this.wallRoot.add(r),this._applyClip(r,this.wallClip)}}}_mapFloor(e){const t=this.layout;if(t.mode==="spatial")return{x:e.nx*t.SCALE,z:e.ny*t.SCALE};if(t.mode==="static")return{x:e.nx*t.FLOOR_SCALE,z:-e.ny*t.FLOOR_SCALE+(this.stanceOffsetZ||0)};const i=t.CAL&&t.CAL[e.foot]||{x:0,z:0};return{x:e.nx*t.X_SCALE+i.x,z:-t.V*e.t-t.STRIKE_AHEAD+i.z}}_mapWall(e){const t=this.layout.WALL;return{x:e.nx*t.XS,y:t.Y0+e.ny*t.YS,z:ve+.02}}_buildLane(e){const t=this.layout;if(t.mode==="advance"){const i=t.V*e.duration+3+1.2,a=new k(new K(.55,i),qi(i));a.rotation.x=-Math.PI/2,a.position.set(0,.01,1.2-i/2),a.renderOrder=3,this.floorRoot.add(a),this._applyClip(a,this._floorClipFor()),this.laneFX=a}else if(t.mode==="spatial"){const i=this.pack.tokens.filter(a=>a.type==="stepMark").sort((a,o)=>a.t-o.t).map(a=>new S(a.nx*t.SCALE,.012,a.ny*t.SCALE));if(i.length>=2){const a=new Si(i),o=new He().setFromPoints(a.getPoints(60)),s=new wt(o,new xt({color:ae.lane,dashSize:.14,gapSize:.1,transparent:!0,opacity:.7}));s.computeLineDistances(),this.floorRoot.add(s),this._applyClip(s,this._floorClipFor())}}}resetLoop(){for(const e of this.events)e.fired=!1,e._wasVisible=!1,e._verdict=null;this.stats={inGaze:0,total:0}}setShake(e,t){this.floorRoot.position.x=e,this.floorRoot.position.z=t+(this.loopShiftZ||0)}update(e,t){const{lead:i,size:a,maxVisible:o}=this.params;if(!this.layout)return;if(this.laneFX){const r=this.laneFX.material.uniforms,v=y.arrow||{};if(r.uTime.value=performance.now()/1e3,r.uW.value=y.graphics.width*(v.w||1),r.uHalo.value=y.graphics.halo*(v.glow??1),r.uGain.value=y.gainBoost*(We?1.25:1),r.uLStyle.value=Qi[y.lane&&y.lane.style||"dash"]??1,r.uLSpeed.value=v.speed??1,r.uLGap.value=v.gap??1,this.pack?.sport==="running"&&this._beatT>0&&this._strideM>0){const L=r.uLStyle.value;if(L===1||L===2){const R=L===1?9:12;r.uLGap.value=R*this._strideM/(2*Math.PI),r.uLSpeed.value=2*Math.PI/(5.2*this._beatT)}}r.uLHeat.value=v.heat??.5,r.uLTail.value=v.tail??.55;const u=y.day||y.markBlend==="ink"?1:0;r.uDay.value!==u&&(r.uDay.value=u,this.laneFX.material.blending=u?Je:ue,this.laneFX.material.needsUpdate=!0);const _=this.rig?._fp;_&&(r.uFPOrigin.value.set(_.ox,0,_.oz),r.uFPFwd.value.set(_.fx,0,_.fz),r.uFPRight.value.set(_.rx,0,_.rz),r.uFPNear.value=this.rig.fpNear,r.uFPFar.value=this.rig.fpFar,r.uFPHalfN.value=this.rig._halfAt(this.rig.fpNear),r.uFPHalfF.value=this.rig._halfAt(this.rig.fpFar))}const l=this.rig?._fp;if(l){const r=this.rig._halfAt(this.rig.fpNear),v=this.rig._halfAt(this.rig.fpFar);for(const u of this.events){const _=u.marker?.fx?.material?.uniforms;!_||!_.uFPNear||(_.uFPOrigin.value.set(l.ox,0,l.oz),_.uFPFwd.value.set(l.fx,0,l.fz),_.uFPRight.value.set(l.rx,0,l.rz),_.uFPNear.value=this.rig.fpNear,_.uFPFar.value=this.rig.fpFar,_.uFPHalfN.value=r,_.uFPHalfF.value=v)}}const h=this.events.filter(r=>r.t>=e-_e.linger),p=new Map;h.forEach((r,v)=>p.set(r,v));for(const r of this.events){const v=p.get(r)??99;let u="hidden",_=0;const L=_e.linger+.6;r._verdict==="miss"&&e>=r.t&&e<r.t+L?(u="miss",_=(e-r.t)/L,r.fired||(r.fired=!0,this._fire(r))):e>=r.t&&e<r.t+_e.linger?(u="linger",_=(e-r.t)/_e.linger,r.fired||(r.fired=!0,this._fire(r))):e>=r.t-i&&e<r.t?(u="countdown",_=(e-(r.t-i))/i):e<r.t-i&&(u=v<o?"preview":"locked"),this.layoutPreview&&r.surface!=="wall"&&(u="preview"),this.liveHideFloorMarks&&r.surface!=="wall"&&(u="hidden"),this.laneFX&&(this.laneFX.visible=!this.liveHideLane);const R=r.marker;if(R?.num&&r.surface!=="wall"&&r.foot){const F=!!y.hideOrderNums;F!==!!R._numFoot&&(R._numFoot=F,R.num.material.map=F?aa(r.foot==="right"):kt(R._numN??""),R.num.material.needsUpdate=!0)}if(r.marker){if(r.surface==="wall"){const C=this._mapWall(r.srcToken);r.marker.group.position.set(C.x,C.y,C.z)}else{const C=this._mapFloor(r.srcToken);if(r.marker.group.position.set(C.x,.012,C.z),this.footprintTest&&u!=="hidden"&&!this.layoutPreview){const M=C.x+this.floorRoot.position.x,$=C.z+this.floorRoot.position.z,ye=r.marker.radius*a*1.15;this.footprintTest(M,$,ye)||(u="hidden");const J=u==="preview"||u==="countdown";if(J&&!r._wasVisible){const Fe=this.gazeTest?this.gazeTest(M,$):!0;this.stats.total++,Fe&&this.stats.inGaze++}r._wasVisible=J}}u==="preview"&&v>=o&&!this.layoutPreview&&(u="hidden");const F=this.layoutPreview?0:Math.min(v,Ot.length-1);r.marker.strongPreview=this.layoutPreview,r.marker.render(u,_,F,a),r.stripes&&(r.stripes.visible=u==="countdown"||u==="linger")}if(r.arrow){const F=r.arrow;let C=this.layoutPreview||e>=F.t-i&&e<F.t+F.lifetime;if(C&&this.footprintTest&&!this.layoutPreview&&(C=this.footprintTest(F.obj.position.x+this.floorRoot.position.x,F.obj.position.z+this.floorRoot.position.z)),F.obj.visible=C,C){const $=.35+.55*(this.layoutPreview?1:Math.min(1,(e-(F.t-i))/Math.max(i,.001)));F.obj._gain=$,F.obj.scale.setScalar(a)}}}}fieldVisible(e){return this.root.visible&&(e==="wall"?this.wallRoot:this.floorRoot).visible}_fire(e){if(!this.fieldVisible(e.surface))return;const t=e.t<.15,i=e.marker?e.marker.group.getWorldPosition(new S):new S,a=e.surface==="wall"?new S(0,0,1):new S(0,1,0),o=e.srcToken?.design?.burst,s=o&&o.on?{...o}:{};e.surface==="wall"&&(s.sizeM=(e.marker?.radius??.15)*1.9,s.intensity=(s.intensity??1)*.8,s.speed=(s.speed??1)*1.35),e.surface!=="wall"&&this.layout?.mode==="advance"&&(s.forward=!0,i.z-=.18,s.intensity=(s.intensity??1)*1.7,s.rings=Math.max(s.rings??1,1.8)),t||this.effects.burst(i,e.color,a,s),this.onEvent&&this.onEvent(e)}studioBurst(e){if(!this.layout||!e)return;const t=this._mapFloor({nx:e.nx,ny:e.ny??0,t:e.t,foot:e.foot}),i=new S(t.x+this.floorRoot.position.x,.02,t.z+this.floorRoot.position.z),a=e.design?.burst,o=e.design?.fill?.c0||"#fa3030";this.effects.burst(i,o,new S(0,1,0),{...a&&a.on?a:{},noClip:!0})}}export{da as B,ae as C,Tt as F,ia as L,q as M,Fi as O,ma as T,Y as U,ve as W,qi as a,ra as b,Ft as c,ua as d,_e as e,ca as f,D as g,$i as m,pa as s,fa as t};
