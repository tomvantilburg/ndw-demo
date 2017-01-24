var WebSocketServer = require('ws').Server
  , express = require('express')
  , app = express()
  ,pg = require('pg').native
  ,http = require('http')
  ,cluster=require('cluster');


var client = new pg.Client({
    user: 'geodan',
    password: 'password',
    database: 'research',
    host: 'metis',
    port: 5432
  });
console.log('got client');  
 if (cluster.isMaster) 
  { 
   // Count the machine's CPUs
    var cpuCount = require('os').cpus().length;

    // Create a worker for each CPU
	for (var i = 0; i < cpuCount; i += 1) 
	{
		console.log('forked',i);
		cluster.fork();
	} 
	// Listen for dying workers
	cluster.on('exit', function (worker) {
		// Replace the dead worker,
		// we're not sentimental
		console.log('Worker ' + worker.id + ' died :(');
		cluster.fork();
	}); 
}
else 
{

	client.connect();

	var server = http.createServer(app);
	server.listen(8088);
	console.log('got a server on 8088');
	
	var wss = new WebSocketServer({server: server});

	wss.on('connection', function(ws){
	
		ws.on('message', function(message){
				console.log('received: %s', message);	
				var the_call=JSON.parse(message);
				var querystring = '';
				var interval = the_call.interval || "1 minute";
				querystring = "WITH data AS ( \
						SELECT  \
						$1::Text AS ref, \
						substring(a.location from 22 for 4) dist, \
						date, \
						date_part('HOUR',date) AS hour, \
						date_part('MINUTE',date) AS minute, \
						vehiclespeed, \
						vehicleflow, \
						lanes \
						FROM ndw.trafficspeed a \
						INNER JOIN ndw.mst b ON (a.location = b.mst_id) \
						WHERE date > now() - interval '"+interval+"'\
						AND a.location LIKE $1 \
					) \
					SELECT * FROM data \
					ORDER BY dist, hour, minute;"
				
				
				var road = the_call.road || 'RWS01_MONIBAS_0121hrl0%';
				
				var query = client.query(querystring,[road]);
				
				query.on('row', function(row)
				{
					ws.send(JSON.stringify(row),{binary: false});
				});	
		
				//fired after last row is emitted
				query.on('end', function() 
				{ 
					console.log('done');
				});
			});
		

		/*
		if(the_call.request && the_call.request=="getcapabilities")
		{
			ws.send(JSON.stringify(["capabilities",my_maps]));				
		}	
		else
		{
			parameters=[];
			n_parameters=0;
			my_map=my_maps[the_call.map_name];


			sql_txt="SELECT "+my_map.attributes;

			parameters[n_parameters++]=the_call.nr;
			sql_txt=sql_txt+",set_byte(substring('0'::bytea ,1,1),0,$"+n_parameters+") byte,";
			geometry_column=my_map.geometry_column;

			srid=my_map.default_srid;
			parameters[n_parameters++]=my_map.default_precision;
			
			sql_txt=sql_txt+"ST_AsTWKB(ST_Transform("+geometry_column+",4326),$"+n_parameters+","+my_map.id_column+") geom FROM "+my_map.sql_from;			
			
			sql_txt=sql_txt+" LIMIT 10000";

			console.log("sql_txt:%s",sql_txt);
			console.log("parameters:%s",parameters);
			var query = client.query(sql_txt,parameters);
			var attr=[the_call.nr];

			query.on('row', function(row)
			{
				for (t=0;t<my_map.attributes.length;t++)				{
					
					attr[t+1]=row[my_map.attributes[t]];				
				}
				ws.send(JSON.stringify(attr),{binary: false});
				ws.send(row.geom,{binary: true});
			});	
	
			//fired after last row is emitted
			query.on('end', function() 
			{ 
				console.log('done');
			});
		}
		*/
	});
}