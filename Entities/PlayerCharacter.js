import { Engine, Scene, MeshBuilder, FreeCamera, Vector3, Quaternion, HemisphericLight, VertexBuffer, Axis, Matrix, Space } from "@babylonjs/core/index.js";
import Hull from '../Phyx/shapes/hull'
import Capsule from '../Phyx/shapes/capsule'
import RigidBody from '../Phyx/body'
import { getVerticesFromMesh, Vector3sToArray } from '../Utils'
import qh from 'quickhull3d'




const arrayBuffer = new ArrayBuffer(1024);
const dataView = new DataView(arrayBuffer);



const UpdateConfig = {
    Always:0,
    Delta:1,
    Never:2
}
const impulse = new Vector3();
const localVelocity = new Vector3();
const worldVelocity = new Vector3();

const lerpBasic = function (value1, value2, amount) {
	amount = amount < 0 ? 0 : amount;
	amount = amount > 1 ? 1 : amount;
	return value1 + (value2 - value1) * amount;
};
/*
const lerpWithMinMax = (value1, value2, amount, min, max) => {
    const looped = value2 < value1 ? true : false;
    const difference = looped ? (max-value1)+(min+value2) : value2-value1
    const progress = difference*amount;
    const interpolatedValue = lerp(value1, value1+difference, amount)
    if(interpolatedValue >= max){
        return min+(interpolatedValue-max)
    }
    return interpolatedValue
}
*/

const lerpWithMinMax = (value1, value2, amount, min, max) => {
    const looped = value2 < value1 ? true : false;
    const difference = looped ? (max-value1)+(min+value2) : value2-value1
    const progress = difference*amount;
    const interpolatedValue = lerp(value1, value1+difference, amount)
    return interpolatedValue%max;
}



class PlayerCharacter {
	constructor(scene, world, animationManager){
		
		this.stateBuffer = []
		//this.mesh = MeshBuilder.CreateBox("", {size:2}, scene);
		//this.mesh.position.y = 6;
		
		
		
		
		this.jumpTimer = 0;
		//this.mesh.rotationQuaternion = new Quaternion();
		//this.mesh.computeWorldMatrix(true);
		
		/*
		const meshVertices = getVerticesFromMesh(this.mesh)
		const arrV = Vector3sToArray(meshVertices);
		const indices = qh(arrV, {skipTriangulation:true})
		*/
		
		this.transform = Matrix.Identity();
		
		
		const body = new RigidBody("blah", this.transform)
		body.setMoves(true, false);
		
		/*
		//body.lockAxis(new Vector3(0,1,0))
		const meshShape = new Hull(meshVertices)
		*/
		body.gravity = new Vector3(0,-10,0);
		
		/*
		indices.forEach(index => {
			meshShape.addFace(index)
		})
		body.addShape(meshShape)
		*/
		const capsuleShape = new Capsule(new Vector3(0,0.65,0),new Vector3(0,-0.65,0),0.35)
		body.addShape(capsuleShape)
		//body.angDamping = 0.8;
		//body.linDamping = 0.0005;
		//body.angVelocity.z = 3;				
		
		this.rotationY = 0;
		this.rotationX = 0;
		
		body.canSleep = false;
		this.body = body;
		this.position = this.body.position;
		this.orientation = this.body.orientation;
		this.velocity = this.body.velocity;
	}
	
	get px(){
		return this.position.x;
	}
	
	set px(value){
		this.position.x = value;
	}
	
	get py(){
		return this.position.y;
	}
	
	set py(value){
		this.position.y = value;
	}
	
	get pz(){
		return this.position.z;
	}
	
	set pz(value){
		this.position.z = value;
	}
	
	get vx(){
		return this.velocity.x;
	}
	
	set vx(value){
		this.velocity.x = value;
	}
	
	get vy(){
		return this.velocity.y;
	}
	
	set vy(value){
		this.velocity.y = value;
	}
	
	get vz(){
		return this.velocity.z;
	}
	
	set vz(value){
		this.velocity.z = value;
	}
	
	get rx(){
		return this.rotationX;
	}
	set rx(value){
		this.rotationX = value;
		
		if(!this.mesh){return;}
		Quaternion.RotationAxisToRef(Axis.Y, this.rotationX, this.mesh.rotationQuaternion)
	}
	
	get ry(){
		return this.rotationY;
	}
	set ry(value){
		this.rotationY = value;
		
		if(!this.mesh || !this.head){return;}
		Quaternion.RotationAxisToRef(Axis.X, this.rotationY, this.head.rotationQuaternion)
		
		if(this.mesh.skeleton){
			this.mesh.skeleton.bones[1].setRotation(new Vector3(0, 0, 0.4 - value), Space.LOCAL);    
        }
		
	}
	
	
	ToNetworkState(){
		return {
			px:this.px,py:this.py,pz:this.pz,
			vx:this.vx,vy:this.vy,vz:this.vz
		}
	}
	
	
	
	
	insertState(time, state){
		this.stateBuffer.push({timestamp:time,state:state});
		this.sortState();
		this.pruneState();
		
	}
	
	sortState(){
		this.stateBuffer.sort((a,b)=>{return a.time-b.time;})
	}
	
	pruneState(){
		if(this.stateBuffer.length > 60){
			this.stateBuffer.splice(0,1);
		}
	}
	
	getInterpolatedState(time){
		let i = 0;
		while(this.stateBuffer[i] && this.stateBuffer[i].timestamp < time) i++;
			const before = this.stateBuffer[i-1];
			const after = this.stateBuffer[i];
			if(!after){
				return this;
			}
			if(!before){
				return after.state;
			}
			const alpha = (time - before.timestamp) / (after.timestamp - before.timestamp);
			const interpolatedState = {}
			//console.log("ALPHA", alpha)
			this.constructor.Schema.forEach(schema => {
				if(schema.interpolated){
					interpolatedState[schema.key] = before.state[schema.key] + (after.state[schema.key] - before.state[schema.key]) * alpha;
				} else {
					//console.log(after)
					interpolatedState[schema.key] = after.state[schema.key];
				}
				
			})
			
			return interpolatedState;
	}
	
	
	SetPlayerInputs(inputs){
		
		localVelocity.set(0,0,0);
		
		this.rx = inputs.rotationX;
		this.ry = inputs.rotationY;
		
		this.mesh.computeWorldMatrix()
		this.head.computeWorldMatrix()
		
		//console.log(this.rotationX)
		if(this.mesh){
			//Quaternion.RotationAxisToRef(new Vector3(0,1,0), this.rotationX, this.mesh.rotationQuaternion)
			
		}
		const speed = 8500;
		if(inputs.forward){
			//impulse.z = speed;
			localVelocity.z = 5;
		} else if(inputs.backward){
			localVelocity.z = -5;
		}
		
		if(inputs.left){
			localVelocity.x = -5;
		} else if(inputs.right){
			localVelocity.x = 5;
		}
		
		this.jumpTimer -= 0.016;
		
		Vector3.TransformNormalToRef(localVelocity, this.mesh.getWorldMatrix(), worldVelocity);
		
		const oldYVelocityComponent = this.velocity.y;
		
		this.velocity.copyFrom(worldVelocity);
		
		this.velocity.y = oldYVelocityComponent;
		
		if(inputs.jump){
			if(this.jumpTimer <= 0){
				this.jumpTimer = 0.4;
				this.velocity.y = 6;
			}
		}
		
		
		
		
		//this.body.addForce(impulse)
	}
	
	
}





PlayerCharacter.Serialize = (entity, classID, type) => {
    let offset = 0;
    dataView.setUint8(offset, classID);offset += 1;
    dataView.setUint8(offset, type);offset += 1;
    dataView.setUint16(offset, entity.id);offset += 2;
    if(type == 0 || type == 2){
        //console.log("Create Entity");
        dataView.setFloat32(offset, entity.px);offset += 4;
        dataView.setFloat32(offset, entity.py);offset += 4;
        dataView.setFloat32(offset, entity.pz);offset += 4;
        dataView.setFloat32(offset, entity.vx);offset += 4;
        dataView.setFloat32(offset, entity.vy);offset += 4;
        dataView.setFloat32(offset, entity.vz);offset += 4;
        dataView.setFloat32(offset, entity.rx);offset += 4;
        dataView.setFloat32(offset, entity.ry);offset += 4;

        return arrayBuffer.slice(0, offset);
    } else if(type == 1) {
        let bitMask = 0;
        if(entity.px !== null){
            bitMask |= 1;
        }
        if(entity.py !== null){
            bitMask |= 2;
        }
        if(entity.pz !== null){
            bitMask |= 4;
        }
        if(entity.rx !== null){
            bitMask |= 8;
        }
        if(entity.ry !== null){
            bitMask |= 16;
        }
        dataView.setUint8(offset, bitMask);offset += 1;
        if(entity.px !== null){
            dataView.setFloat32(offset, entity.px);offset += 4;
        }
        if(entity.py !== null){
            dataView.setFloat32(offset, entity.py);offset += 4;
        }
        if(entity.pz !== null){
            dataView.setFloat32(offset, entity.pz);offset += 4;
        }
        if(entity.rx !== null){
            dataView.setFloat32(offset, entity.rx);offset += 4;
        }
        if(entity.ry !== null){
            dataView.setFloat32(offset, entity.ry);offset += 4;
        }
        return arrayBuffer.slice(0, offset);
    }
}



PlayerCharacter.Deserialize = (view) => {
    const entity = {};
    const dataView = view.view;
    const type = dataView.getUint8(view.offset);
    entity.type = type;
    view.offset += 1;
    entity.id = dataView.getUint16(view.offset);
    view.offset += 2;
    entity.class = PlayerCharacter;
    if(type == 0 || type == 2){
        //console.log("Deserialize Entity");
        entity.px = dataView.getFloat32(view.offset);
        view.offset += 4;
        entity.py = dataView.getFloat32(view.offset);
        view.offset += 4;
        entity.pz = dataView.getFloat32(view.offset);
        view.offset += 4;
        entity.vx = dataView.getFloat32(view.offset);
        view.offset += 4;
        entity.vy = dataView.getFloat32(view.offset);
        view.offset += 4;
        entity.vz = dataView.getFloat32(view.offset);
        view.offset += 4;
        entity.rx = dataView.getFloat32(view.offset);
        view.offset += 4;
        entity.ry = dataView.getFloat32(view.offset);
        view.offset += 4;

        return { entity, type }
    } else if(type == 1){
        const bitMask = dataView.getUint8(view.offset);view.offset += 1;
        if(bitMask & 1){
            entity.px = dataView.getFloat32(view.offset);view.offset += 4;
        }
        if(bitMask & 2){
            entity.py = dataView.getFloat32(view.offset);view.offset += 4;
        }
        if(bitMask & 4){
            entity.pz = dataView.getFloat32(view.offset);view.offset += 4;
        }

        if(bitMask & 8){
            entity.rx = dataView.getFloat32(view.offset);view.offset += 4;
        }
        if(bitMask & 16){
            entity.ry = dataView.getFloat32(view.offset);view.offset += 4;
        }

        return { entity, type }
    }
}







PlayerCharacter.Schema = [
	{key:'id', type:'Uint16', config:UpdateConfig.Always},
    {key:'px', type:'Float32', interpolated:true, config:UpdateConfig.Delta},
    {key:'py', type:'Float32', interpolated:true, config:UpdateConfig.Delta},
    {key:'pz', type:'Float32', interpolated:true, config:UpdateConfig.Delta},
    {key:'vx', type:'Float32', config:UpdateConfig.Never},
    {key:'vy', type:'Float32', config:UpdateConfig.Never},
    {key:'vz', type:'Float32', config:UpdateConfig.Never},
	{key:'rx', type:'Float32', interpolated:true, config:UpdateConfig.Delta},
	{key:'ry', type:'Float32', interpolated:true, config:UpdateConfig.Delta}
]

PlayerCharacter.SchemaDir = 'Entities';

PlayerCharacter.SchemaType = 'Entity';




export default PlayerCharacter