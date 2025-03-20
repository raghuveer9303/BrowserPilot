#!/bin/bash
x11vnc -display :99 -forever -shared -rfbport 5901 -wait 5 -passwd ${VNC_PASSWORD:-password}
