
pipeline {
    agent any

    environment {
        DOCKER_REGISTRY = "docker.io"
        IMAGE_TAG = "zafeeruddin/custom-node-red"
    }

    stages {
        stage('Checkout Code') {
            steps {
                echo "Checking out the source code..."
                checkout scm
            }
        }


        stage("Docker Build and Push") {
            steps {
                echo 'Building Docker Image...'
                script {
                    withCredentials([usernamePassword(credentialsId: 'docker-hub-credentials', 
                                                     usernameVariable: 'DOCKER_CREDENTIALS_USR', 
                                                     passwordVariable: 'DOCKER_CREDENTIALS_PSW')]) {
                        sh """
                            echo ${DOCKER_CREDENTIALS_PSW} | docker login ${DOCKER_REGISTRY} -u ${DOCKER_CREDENTIALS_USR} --password-stdin
                            docker build -t ${IMAGE_TAG} .
                            docker push ${IMAGE_TAG}
                        """
                        echo "Docker image ${IMAGE_TAG} built and pushed successfully."
                    }
                }
            }
        }

        stage("Redeploy App on Kubernetes") {
            steps {
                echo 'Redeploying application on Kubernetes...'
                script {
                    withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG')]) {
                        sh """
                            kubectl set image deployment/nodered-deployment nodered=${IMAGE_TAG} --kubeconfig=$KUBECONFIG -n jenkins
                            kubectl rollout status deployment/nodered-deployment --kubeconfig=$KUBECONFIG -n jenkins
                        """
                    }
                }
            }
        }
    }
}
