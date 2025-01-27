def DOCKER_USER_NAME = "zafeeruddin"
def DOCKER_USER_PASSWORD = credentials("docker-hub-credentials")
def KUBE_CONFIG = credentials("kubeconfig")


pipeline {
    agent any

    environment {
        DOCKER_CREDENTIALS = credentials("docker-hub-credentials")  
        KUBE_CONFIG = credentials("kubeconfig")
        DOCKER_REGISTRY = "docker.io"  
        REPO_URL = "https://github.com/masterworks-engineering/k8s-percepto.git"  
        IMAGE_NAME = "zafeeruddin/custom-node-red"  
        IMAGE_TAG = "${IMAGE_NAME}:${env.BUILD_NUMBER}"  
        GITHUB_TOKEN = credentials("github-zafeercodes")
        DOCKER_CREDENTIALS_PSW = credentials('DOCKER_CREDENTIALS_PSW') // Replace with the actual ID of your Docker credentials
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
                    sh """
                        echo ${DOCKER_CREDENTIALS_PSW} | docker login ${DOCKER_REGISTRY} -u ${DOCKER_CREDENTIALS_USR} --password-stdin
                        docker build -t ${IMAGE_TAG} .
                        docker push ${IMAGE_TAG}
                    """
                    echo "Docker image ${IMAGE_TAG} built and pushed successfully."
                }
            }
        }

        stage("Redeploy App on Kubernetes") {
            steps {
                echo 'Redeploying application on Kubernetes...'
                script {
                    withCredentials([file(credentialsId: 'kubeconfig', variable: 'KUBECONFIG')]) {
                        sh """
                            kubectl set image deployment/nodered-deployment nodered=${IMAGE_TAG} --kubeconfig=$KUBECONFIG
                            kubectl rollout status deployment/nodered-deployment --kubeconfig=$KUBECONFIG
                        """
                    }
                }
            }
        }
    }
}
