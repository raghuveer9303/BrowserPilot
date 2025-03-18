FROM mcr.microsoft.com/playwright:v1.51.1-jammy

# Remove hardcoded API key
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
    && rm -rf /var/lib/apt/lists/*

# Set up environment
ENV DISPLAY=:99
ENV RESOLUTION=1280x720x24

# Create required directories
RUN mkdir -p /opt/app /opt/scripts /opt/logs /videos

# Copy application files
COPY app/ /opt/app/
COPY scripts/ /opt/scripts/
COPY config/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Install dependencies
WORKDIR /opt/app
RUN npm install

# Make scripts executable
RUN chmod +x /opt/scripts/*.sh

# Expose ports
EXPOSE 3000 6080 5900

# Start supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]