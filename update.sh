# rsync -rv --checksum --exclude '.DS_Store' --exclude '*.map' --delete ../insteon-plm/dist/ pi@10.0.1.55:./insteon-plm-dist;
# ssh pi@10.0.1.55 'sudo cp -R /home/pi/insteon-plm-dist/* /root/docker-volumes/nodered/_data/node_modules/insteon-plm/dist';


##use this to setup the port forward
##ssh 25ssrd.mooo.com -L 2201:10.0.1.55:22

rsync -rv --checksum -e 'ssh -p 2201' --exclude '.DS_Store' --exclude '*.map' --delete ../insteon-plm/dist/ pi@localhost:./insteon-plm-dist;
ssh pi@localhost -p 2201 'sudo cp -R /home/pi/insteon-plm-dist/* /root/docker-volumes/nodered/_data/node_modules/insteon-plm/dist';

ssh pi@localhost -p 2201 'docker restart 489d3d0cfe73';