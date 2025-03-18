FROM mcr.microsoft.com/playwright:v1.51.1-jammy

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=UTC

ENV GEMINI_API_KEY=AIzaSyBPS3MblzMA0tK1_h7aOFOKKJvaO1NOqqc

# Install required packages
RUN apt-get update && apt-get install -y \
    x11vnc \
    xvfb \
    novnc \
    supervisor \
    net-tools \
    curl \
    tzdata \
    && ln -fs /usr/share/zoneinfo/UTC /etc/localtime \
    && dpkg-reconfigure --frontend noninteractive tzdata \
    && rm -rf /var/lib/apt/lists/*

# Set up environment
ENV DISPLAY=:99
ENV RESOLUTION=1280x720x24


# Create directories
RUN mkdir -p /opt/app /opt/scripts /opt/logs

# Copy application files
COPY app/ /opt/app/
COPY scripts/ /opt/scripts/

# Install Node.js dependencies
WORKDIR /opt/app
RUN npm install


COPY config/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Make scripts executable
RUN chmod +x /opt/scripts/*.sh

# Expose ports
EXPOSE 3000 6080 5900

# Start supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]