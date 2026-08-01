FROM python:3.11-slim

ENV TZ=Europe/Dublin
RUN ln -snf /usr/share/zoneinfo/$TZ /etc/localtime && echo $TZ > /etc/timezone

RUN apt-get update && apt-get install -y --no-install-recommends \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app
RUN pip install --no-cache-dir lightgbm pandas numpy requests mysql-connector-python schedule holidays
COPY . .
CMD ["python", "script/Predict.py"]






