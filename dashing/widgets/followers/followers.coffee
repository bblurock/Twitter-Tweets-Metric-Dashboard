class Dashing.Followers extends Dashing.Widget

  createChart: (data) ->
    $('#followers').highcharts 'StockChart',
      # chart: type: 'spline'
      title: text: 'Daily Followers Growth'
      legend: 
        enabled: true
      # subtitle: text: 'This chart display the new fllowers amount gained by each account'
      rangeSelector:
        selected: 4
        allButtonsEnabled: true
        enable: true
      xAxis:
        type: 'datetime'
        dateTimeLabelFormats:
          month: '%e. %b'
          year: '%b'
        title: text: 'Date'
      yAxis:
        title: text: 'Followers'
        min: 0
      plotOptions:
        series:
          lineWidth: 1
        spline:
          marker:
            enabled: true
      series:
        data
      tooltip:
        pointFormat: '<span style="color:{series.color}">{series.name}</span>: {point.y}<br/>'
    return
    
  onData: (data) ->
    legendDefault = {
      "tickleapp": true,
      "wonderworkshop": false, 
      "spheroedu": false,
      "gotynker": false,
      "hopscotch": false,
      "codehs": false,
      "kodable": false,
      "codeorg": false,
      "scratch": false,
      "trinketapp": false
    }
    
    data = JSON.parse(data.data)
    data.map (x) ->
      x.visible = legendDefault[x.name]
      
    @createChart(data)  
