FROM mcr.microsoft.com/playwright:v1.41.0-jammy

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=UTC

# Install Python 3.11
RUN apt-get update && apt-get install -y \
    x11vnc \
    xvfb \
    novnc \
    supervisor \
    net-tools \
    curl \
    tzdata \
    software-properties-common \
    && add-apt-repository ppa:deadsnakes/ppa \
    && apt-get update \
    && apt-get install -y python3.11 python3.11-venv python3.11-dev \
    && ln -fs /usr/share/zoneinfo/UTC /etc/localtime \
    && dpkg-reconfigure --frontend noninteractive tzdata \
    && rm -rf /var/lib/apt/lists/*
    
# Use Python 3.11 as default
RUN update-alternatives --install /usr/bin/python3 python3 /usr/bin/python3.11 1

# Install pip for Python 3.11
RUN curl -sS https://bootstrap.pypa.io/get-pip.py | python3.11

# Set up environment
ENV DISPLAY=:99
ENV RESOLUTION=1280x720x24
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Create Python virtual environment
RUN python3 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create directories
RUN mkdir -p /opt/app /opt/scripts /opt/logs /opt/results

# Copy scripts first for caching efficiency
COPY scripts/ /opt/scripts/
RUN chmod +x /opt/scripts/*.sh

# Copy requirements and install Python dependencies
COPY requirements.txt /opt/app/
RUN pip install --no-cache-dir -r /opt/app/requirements.txt

# Install browser-use package
COPY browser_use/browser_use-0.1.40-py3-none-any.whl /app/
RUN pip install --no-cache-dir /app/browser_use-0.1.40-py3-none-any.whl

# Copy application files
COPY backend/ /opt/app/backend/
COPY frontend/ /opt/app/frontend/

# Setup supervisord
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Add noVNC to frontend
RUN mkdir -p /opt/app/frontend/novnc && \
    cp -r /usr/share/novnc/* /opt/app/frontend/novnc/

# Expose ports (FastAPI, VNC, noVNC)
EXPOSE 8000 5900 6080

# Set working directory
WORKDIR /opt/app

# Add app start script
RUN echo '#!/bin/bash\ncd /opt/app && python -m backend.app' > /opt/scripts/start-app.sh && \
    chmod +x /opt/scripts/start-app.sh

# Create symlink to utils
RUN ln -s /usr/share/novnc/utils /opt/app/frontend/novnc/utils

# Start supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]