FROM mcr.microsoft.com/playwright:v1.51.0-jammy

ENV DEBIAN_FRONTEND=noninteractive \
    TZ=UTC

# Install Python 3.11
RUN apt-get update && apt-get install -y \
    x11vnc \
    xvfb \
    supervisor \
    net-tools \
    curl \
    tzdata \
    software-properties-common \
    novnc \
    && add-apt-repository ppa:deadsnakes/ppa \
    && apt-get update \
    && apt-get install -y python3.11 python3.11-venv python3.11-dev \
    && ln -s /usr/bin/python3.11 /usr/local/bin/python3 \
    && ln -s /usr/bin/python3.11 /usr/local/bin/python \
    && apt-get clean \
    && rm -rf /var/lib/apt/lists/*

# Install pip for Python 3.11
RUN curl -sS https://bootstrap.pypa.io/get-pip.py | python3.11

# Set up environment
ENV DISPLAY=:99
ENV RESOLUTION=1280x720x24
ENV PYTHONUNBUFFERED=1
ENV PYTHONDONTWRITEBYTECODE=1

# Create Python virtual environment with Python 3.11
RUN python3.11 -m venv /opt/venv
ENV PATH="/opt/venv/bin:$PATH"

# Create directories
RUN mkdir -p /opt/app /opt/scripts /opt/logs /opt/results

# Copy scripts first for caching efficiency
COPY scripts/ /opt/scripts/
RUN chmod +x /opt/scripts/*.sh

# Copy requirements and install Python dependencies
COPY requirements.txt /opt/app/
RUN pip install --no-cache-dir -r /opt/app/requirements.txt

# Copy the .whl file into the container
COPY browser_use/browser_use-0.1.40-py3-none-any.whl /app/

# Install dependencies
RUN pip install /app/browser_use-0.1.40-py3-none-any.whl

# Create required directories
RUN mkdir -p /opt/app/frontend/novnc /opt/logs

# Copy application files
COPY backend/ /opt/app/backend/
COPY frontend/ /opt/app/frontend/

# Setup supervisord
COPY docker/supervisord.conf /etc/supervisor/conf.d/supervisord.conf

# Install noVNC properly
RUN git clone https://github.com/novnc/noVNC.git /opt/novnc && \
    git clone https://github.com/novnc/websockify /opt/novnc/utils/websockify && \
    ln -s /opt/novnc/vnc.html /opt/novnc/index.html && \
    chmod +x /opt/novnc/utils/websockify/run

# Copy noVNC files to frontend
RUN mkdir -p /opt/app/frontend/novnc && \
    cp -r /opt/novnc/* /opt/app/frontend/novnc/ && \
    chmod +x /opt/novnc/utils/websockify/run

# Expose ports (FastAPI, VNC, noVNC)
EXPOSE 8000 5900 6080

# Set working directory
WORKDIR /opt/app

# Start supervisor
CMD ["/usr/bin/supervisord", "-c", "/etc/supervisor/conf.d/supervisord.conf"]