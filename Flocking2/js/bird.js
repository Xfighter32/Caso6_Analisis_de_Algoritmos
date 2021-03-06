var ranking = {
	maslargo1 : 11.930765,
	maslargo2 : 11.729464,
	mascorto1 : 8.678069,
	mascorto2 : 9.313357,
	masrapida1 : 6.963953,
	masrapida2 : 6.450825,
	maslenta1 : 2.001000,
	maslenta2 : 2.005175
}
var Bird = function(scene, octree, obstacles, velocity_hash, position, orientation) {
	this.scene = scene;
	this.octree = octree;
	this.obstacles = obstacles;
	this.velocity_hash = velocity_hash;
	this.line;
	this.sphere;
	this.mesh;
	this.init_mesh(position, orientation);
	this.separation_size = 1;
	this.acceleration = new THREE.Vector3(0, 0, 0);
	this.min_speed = 4;
	this.max_speed = 10;
	this.max_delta = .01;
	this.area_size = 5;
	this.velocity = new THREE.Vector3(this.min_speed*Math.cos(this.mesh.rotation.y), 0, this.min_speed*Math.sin(this.mesh.rotation.y));

	this.separation_gain = 1;
	this.cohesion_gain = 1;
	this.alignment_gain = 1;

	this.max_climb = 1;

	this.bound_strength = 1;

	this.total_distance = 0.0;
	this.previous_position;
	this.view_option = 0; // distancia por defecto
	this.view_mode = 0;	// automatico por defecto
	this.total_elapsed_time = 0;
}

Bird.prototype.set_view_mode = function(p_view_mode) {
	this.view_mode = p_view_mode;
	console.log(this.view_mode);
};

Bird.prototype.set_view_option = function(p_view_option) {
	this.view_option = p_view_option;
};

Bird.prototype.change_color_distance = function() {
	if (this.total_distance > ranking["maslargo1"]) {
		this.mesh.material = new THREE.MeshBasicMaterial( { color: 0xe00f00, side: THREE.DoubleSide } );
	}
	else if (this.total_distance > ranking["maslargo2"]) {
		this.mesh.material = new THREE.MeshBasicMaterial( { color: 0xf57c73, side: THREE.DoubleSide } );
	}
	else if (this.total_distance > ranking["mascorto1"]) {
		this.mesh.material = new THREE.MeshBasicMaterial( { color: 0xe0d500, side: THREE.DoubleSide } );
	}
	else if (this.total_distance > ranking["mascorto2"]) {
		this.mesh.material = new THREE.MeshBasicMaterial( { color: 0xede88e, side: THREE.DoubleSide } );
	}
};

Bird.prototype.change_color_velocity = function() {
	if (this.velocity.length() > ranking["masrapida1"]) {
		this.mesh.material = new THREE.MeshBasicMaterial( { color: 0x007d28, side: THREE.DoubleSide } );
	}
	else if (this.velocity.length()  > ranking["masrapida2"]) {
		this.mesh.material = new THREE.MeshBasicMaterial( { color: 0x66e890, side: THREE.DoubleSide } );
	}
	else if (this.velocity.length()  > ranking["maslenta1"]) {
		this.mesh.material = new THREE.MeshBasicMaterial( { color: 0x003ec4, side: THREE.DoubleSide } );
	}
	else if (this.velocity.length()  > ranking["maslenta2"]) {
		this.mesh.material = new THREE.MeshBasicMaterial( { color: 0x5c83d6, side: THREE.DoubleSide } );
	}
};

Bird.prototype.change_color_controlled = function(option) {
	if (option == 0){
		this.change_color_distance();
	}
	else {
		this.change_color_velocity();
	}
};

Bird.prototype.change_color_auto = function() {
	this.change_color_velocity();
	this.change_color_distance();
};

Bird.prototype.init_mesh = function(position, orientation) {
	var geometry = new BirdObject();
	var material =  new THREE.MeshBasicMaterial( { color: 0xAAAAAA, side: THREE.DoubleSide } )
	geometry.dynamic = true;
	var mesh = new THREE.Mesh(geometry, material);
	mesh.phase = Math.floor( Math.random() * 62.83 );


	var rot_mat = new THREE.Matrix4();
	// rot_mat.setRotationFromEuler(new THREE.Vector3(0, 0, -Math.PI/2));//rotate on X 90 degrees
	// geometry.applyMatrix(rot_mat);

	// mesh.scale = 1;
	mesh.scale = new THREE.Vector3(.1, .1, .1);
	mesh.position = position;
	this.previous_position = position;	// Se inicia el previous position en la posicion origen del pajaro
	mesh.rotation = orientation;
	this.mesh = mesh;
	this.scene.add(this.mesh);
	this.octree.add(this.mesh);

	var line_material = new THREE.LineBasicMaterial({
        color: 0x999999
    });

    var line_geometry = new THREE.Geometry();
    line_geometry.dynamic = true;
    line_geometry.vertices.push(new THREE.Vector3(0, 0, 0));
    line_geometry.vertices.push(new THREE.Vector3(0, 0, 0));

    this.line = new THREE.Line(line_geometry, line_material);
    // this.scene.add(this.line);

    var sphere_material = new THREE.MeshBasicMaterial({
    	color: 0xaaaaaa,
        wireframe: true
    });

    var sphere_geometry = new THREE.SphereGeometry(3, 8, 8);

    this.sphere = new THREE.Mesh(sphere_geometry, sphere_material);

    // this.scene.add(this.sphere);

};

Bird.prototype.apply_limit = function(vector, min, max) {
	if (vector.length() > max) {
		vector.normalize();
		vector.multiplyScalar(max);
	}
	
	if (vector.length() < min) {
		vector.normalize();
		vector.multiplyScalar(min);
	}

	vector.y = Math.min(vector.y, 2*this.max_climb);
};

Bird.prototype.update_forces = function() {
	var v1, v2, v3;

	v1 = this.cohesion();
	v2 = this.separation();
	v3 = this.alignment();
	v4 = this.bound();
	v5 = this.center();

	this.apply_force(v1);
	this.apply_force(v2);
	this.apply_force(v3);
	this.apply_force(v4);
};

Bird.prototype.cohesion = function() {
	var flock_size = this.octree.objects.length;
	var v1 = new THREE.Vector3(0, 0, 0);

	var search = this.octree.search(this.mesh.position, 10);

	for (var i = 0; i < search.length; i++) {
		if (search[i].object == this.mesh || this.mesh.position.angleTo(search[i].position) > Math.PI) continue;

		// console.log(this.mesh.position.angleTo(search[i].position)); 

		v1.add(search[i].position);
	}

	v1.divideScalar(search.length);

	v1.sub(this.mesh.position);
	v1.divideScalar(300/this.cohesion_gain);

	return v1;
};

Bird.prototype.separation = function() {
	var v2 = new THREE.Vector3(0, 0, 0);

	var search = this.octree.search(this.mesh.position, this.separation_size);

	for (var i = 0; i < search.length; i++) {
		if (search[i].object == this.mesh || this.mesh.position.angleTo(search[i].position) > Math.PI) continue;

		var offset = new THREE.Vector3(0, 0, 0);
		offset.subVectors(search[i].object.position, this.mesh.position);
		v2.sub(offset);
	}
	v2.divideScalar(300/this.separation_gain);
	return v2;
};

Bird.prototype.alignment = function() {
	var v3 = new THREE.Vector3(0, 0, 0);

	var search = this.octree.search(this.mesh.position, 5);

	for (var i = 0; i < search.length; i++) {
		if (search[i].object == this.mesh || this.mesh.position.angleTo(search[i].position) > Math.PI) continue;

		var current_bird = search[i].object;
		var velocity = this.velocity_hash.get(current_bird);
		v3 = v3.add(velocity);
	}

	v3.divideScalar(search.length-1);

	v3.sub(this.velocity);

	return v3.divideScalar(15/this.alignment_gain);
};

Bird.prototype.bound = function() {
	var v4 = new THREE.Vector3(0, 0, 0);
	var bounding_force = .05*this.bound_strength;
	if (this.mesh.position.x > this.area_size) {
		var diff = Math.abs(this.mesh.position.x - this.area_size);
		v4.x = -bounding_force*diff;
	}
	if (this.mesh.position.x < -this.area_size) {
		var diff = Math.abs(this.mesh.position.x - this.area_size);
		v4.x = bounding_force*diff;
	}

	if (this.mesh.position.y > this.area_size) {
		var diff = Math.abs(this.mesh.position.z - this.area_size);
		v4.y = -.5*diff;
	}

	if (this.mesh.position.y < 0) {
		var diff = Math.abs(this.mesh.position.z - this.area_size);
		v4.y = diff;
	}

	if (this.mesh.position.z > this.area_size*2) {
		var diff = Math.abs(this.mesh.position.z - this.area_size);
		v4.z = -bounding_force*diff;
	}
	if (this.mesh.position.z < -this.area_size) {
		var diff = Math.abs(this.mesh.position.z - this.area_size);
		v4.z = bounding_force*diff;
	}

	return v4;

};

Bird.prototype.center = function() {
	var v5 = new THREE.Vector3(0, 0, 0);
	var center_force = .1;


};

Bird.prototype.apply_force = function(force) {
	this.acceleration.add(force);
};

Bird.prototype.get_random_color = function () {
    var letters = '0123456789ABCDEF'.split('');
    var color = '#';
    for (var i = 0; i < 6; i++ ) {
        color += letters[Math.round(Math.random() * 15)];
    }
    return color;
};

Bird.prototype.update_position = function(elapsed_time, lookAt) {
	// this.apply_limit(this.acceleration, this.max_delta);
	this.velocity.add(this.acceleration);
	this.apply_limit(this.velocity, this.min_speed, this.max_speed);

	var displacement = new THREE.Vector3();
	displacement.copy(this.velocity);
	displacement.multiplyScalar(elapsed_time/1000);

	if (elapsed_time/1000 < .5) {
		this.mesh.position.add(displacement);
	}

	// Se acumula la distancia recorrida por pajaro
	var distance= this.previous_position.distanceTo(displacement);
	this.total_distance += distance;

	// Se actualiza la ultima posicion
	this.previous_position = displacement;

	// Se manda a cambiar el color
	this.total_elapsed_time += elapsed_time;
	if (this.total_elapsed_time  > 5000)
	{
		if (this.view_mode == 0) {
		this.change_color_auto();
		}
		else if (this.view_mode == 1) {
			this.change_color_controlled(this.view_option);
		}
	}
	

	this.mesh.rotation.z = this.velocity.y*.1;
	var new_y_rot = Math.atan2(-this.velocity.z, this.velocity.x);
	var y_rot_diff = new_y_rot - this.mesh.rotation.y;
	this.mesh.rotation.y = new_y_rot;
	

	this.mesh.rotation.x = y_rot_diff;

	this.mesh.phase = ( this.mesh.phase + ( Math.max( 0, this.velocity.y) + .1 )  ) % 62.83; 

	// this.mesh.phase = (this.mesh.phase + .3) % 62.83;

	this.mesh.geometry.vertices[ 5 ].y = this.mesh.geometry.vertices[ 4 ].y = Math.sin( this.mesh.phase ) * 5;
	this.mesh.geometry.verticesNeedUpdate = true;


	//Drawing lines
	this.line.geometry.vertices[0] = this.mesh.position;
	this.line.geometry.vertices[1] = lookAt;
	this.line.geometry.verticesNeedUpdate = true;

	this.sphere.position = this.mesh.position;
	this.sphere.rotation = this.mesh.rotation;

	this.acceleration.set(0, 0, 0);

};