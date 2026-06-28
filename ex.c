typedef struct {
    char name[20];
    int is_hub; // 1 se è uno snodo principale, 0 altrimenti
} Station;

void findLongestRoute(int *times[], int n) {
    int max_time = 0;
    for (int i = 0; i < n; i++) {
        for (int j = 0; j < n; j++) {
            if (times[i][j] > max_time && i != j && times[i][j] != -1) {
                max_time = times[i][j];
            }
        }
    }
    printf("tempo max: %d minuti\n", max_time);
}
void hubConnectivity(Station *listStation, int *times[], int n) {
    for (int i = 0; i < n; i++) {
        if (listStation[i].is_hub == 1) {
            int connections = 0;
            for (int j = 0; j < n; j++) {
                if (times[i][j] > 0) {
                    connections++;
                }
            }
            printf("Hub %s: %d connessioni\n", listStation[i].name, connections);
        } else {
            continue;
        }
    }
}