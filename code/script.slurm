#!/bin/bash
#SBATCH --job-name=marbert_train
#SBATCH --output=/home/soufiane.essahli/logs/marbert_train_%j.out
#SBATCH --error=/home/soufiane.essahli/logs/marbert_train_%j.err
#SBATCH --nodes=1
#SBATCH --ntasks=1
#SBATCH --cpus-per-task=16
#SBATCH --mem=64G
#SBATCH --time=12:00:00
#SBATCH --partition=gpu                                # ✅ utiliser la partition GPU
#SBATCH --account=VR_OUTSEC-VH2SZ1T4FKS-DEFAULT-CPU
#SBATCH --gres=gpu:1                                   # ✅ demander 1 GPU

# Charger Anaconda
module load Anaconda3

# Activer l’environnement conda
source ~/.bashrc
conda activate fakezero

# Désactiver solara (si activé)
jupyter server extension disable solara.server.jupyter.server_extension || true

# Info pour tunnel SSH
node=$(hostname -s)
user=$(whoami)
cluster="toubkal.hpc"
port=8888

echo -e "
Command to create SSH tunnel: 
ssh -N -f -L ${port}:${node}:${port} ${user}@${cluster}.um6p.ma  

Use a browser on your local machine to go to: http://localhost:${port}  
(prefix w/ https:// if using a password) 
"

# Lancer le serveur Jupyter
jupyter notebook --no-browser --ip=0.0.0.0 --port=${port}