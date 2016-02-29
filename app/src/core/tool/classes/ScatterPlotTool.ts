interface FeatureData {
    name: string;
    values: number[];
    ids: number[];
}

class ScatterPlotTool extends Tool {
    constructor(appInstance: AppInstance) {
        super(
            appInstance,
            'ScatterPlot',
            'Scatter Plot',
            'Plot one feature against another feature', {
                templateUrl: '/templates/tools/modules/scatterplot/scatterplot.html',
                icon: 'SCA',
                defaultWindowWidth: 900,
                defaultWindowHeight: 1040
            }
          )
    }

    handleResult(res: ToolResult) {
        console.log(res);
    }

    fetchFeatureData(objectType: MapObjectType, featureName: string): ng.IPromise<FeatureData> {
        var $http = $injector.get<ng.IHttpService>('$http');
        return $http.get('/api/experiments/' + this.appInstance.experiment.id +
                  '/features/' + objectType + '/' + featureName)
        .then((resp: any) => {
            return resp.data;
        });
    }
}
