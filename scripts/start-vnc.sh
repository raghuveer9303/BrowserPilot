#!/bin/bash
x11vnc -display :99 -forever -shared -wait 5 -passwd ${VNC_PASSWORD:-password}
