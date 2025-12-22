module.exports = {
  apps: [{
    name: 'pipeline.mojo',
    script: 'server.js',
    cwd: '/root/projects/pipeline.mojo',
    instances: 1,
    exec_mode: 'fork',
    watch: false,
    max_memory_restart: '500M',
    env: {
      NODE_ENV: 'production',
      PORT: 46006
    },
    error_file: '/root/projects/pipeline.mojo/logs/error.log',
    out_file: '/root/projects/pipeline.mojo/logs/out.log',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    merge_logs: true
  }]
};
