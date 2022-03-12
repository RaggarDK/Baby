
class PlayerCharacterUpdateFull {
	constructor(id, px, py, pz, vx, vy, vz, rx, ry){
		this.id = id;
		this.px = px;
		this.py = py;
		this.pz = pz;
		this.vx = vx;
		this.vy = vy;
		this.vz = vz;
		this.rx = rx;
		this.ry = ry;
	}
	
	
}

PlayerCharacterUpdateFull.Schema = [
	{key:'id', type:'Uint16'},
    {key:'px', type:'Float32', interpolated:true},
    {key:'py', type:'Float32', interpolated:true},
    {key:'pz', type:'Float32', interpolated:true},
    {key:'vx', type:'Float32'},
    {key:'vy', type:'Float32'},
    {key:'vz', type:'Float32'},
	{key:'rx', type:'Float32', interpolated:true},
	{key:'ry', type:'Float32', interpolated:true}
]

PlayerCharacterUpdateFull.SchemaDir = 'entityUpdateFull';

PlayerCharacterUpdateFull.SchemaAllowDeltaEncoding = true;


export default PlayerCharacterUpdateFull