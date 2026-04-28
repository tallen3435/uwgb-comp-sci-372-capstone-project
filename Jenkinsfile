pipeline {
    agent any

    stages {
        stage('Pull Code') {
            steps {
                git branch: 'main', url: 'https://github.com/tallen3435/uwgb-comp-sci-372-capstone-project.git/'
            }
        }

        stage('Virtual Env with Dependencies') {
            steps {
                sh '''
                    # Create venv if it doesn't exist, then install
                    python3.11 -m venv .venv
                    .venv/bin/pip install -r requirements.txt
                    .venv/bin/pip install gunicorn
                '''
            }
        }

        stage('Deploy') {
            steps {
                sh '''
                    # Kill old processes to free up the port
                    pkill -f gunicorn || true

                    # Added --timeout 120 to prevent 502 Bad Gateway errors during AI generation
                    JENKINS_NODE_COOKIE=dontKillMe nohup .venv/bin/gunicorn --chdir EmailsPlease -w 2 --timeout 120 -b 127.0.0.1:8000 app:app > gunicorn.log 2>&1 &
                '''
            }
        }
    }
}