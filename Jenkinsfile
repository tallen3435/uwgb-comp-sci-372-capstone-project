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

            # The special flag tells Jenkins NOT to kill Gunicorn when the job ends
            JENKINS_NODE_COOKIE=dontKillMe nohup .venv/bin/gunicorn -w 2 -b 127.0.0.1:8000 EmailsPlease.app:app > gunicorn.log 2>&1 &
        '''
    }
}

    }
}
