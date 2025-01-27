pipeline {
    agent any

    environment {
        DOCKER_CREDENTIALS = credentials("docker-hub-credentials")  
        KUBE_CONFIG = credentials("kubeconfig")
        DOCKER_REGISTRY = "docker.io"  
        REPO_URL = "https://github.com/masterworks-engineering/k8s-percepto.git"  
        IMAGE_NAME = "zafeeruddin/custom-node-red"  
        IMAGE_TAG = "${IMAGE_NAME}:${env.BUILD_NUMBER}"  
    }

    stages {
        stage("Checkout") {
            steps {
                script {
                    withCredentials([string(credentialsId: 'github-zafeercodes', variable: 'GITHUB_TOKEN')]) {
                        sh """
                            git clone https://zafeeruddin:${GITHUB_TOKEN}@github.com/masterworks-engineering/percepto-node-red
                            cd k8s-percepto
                        """
                    }
                }
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
